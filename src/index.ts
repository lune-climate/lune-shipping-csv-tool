#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

import {
    ContainerShippingMethod,
    Distance,
    LuneClient,
    MassUnit,
    SimpleShippingMethod,
} from '@lune-climate/lune'
import cliProgress from 'cli-progress'
import minimist from 'minimist'

import { estimatePayload, EstimateResult, LegFromCSV } from './types.js'
import {
    mapLegToLocation,
    parseCSV,
    sleep,
    trimAndRemoveEmptyEntries,
    writeResultsToCSV,
} from './utils.js'

/**
 * Takes one journey (a single row from CSV)
 * Returns a payload object { shipment, legs } ready for Lune API createMultiLegShippingEstimate method
 * @param journey
 */
function buildEstimatePayload(journey: Record<string, string>): estimatePayload {
    const trimmedJourney = trimAndRemoveEmptyEntries(journey)

    if (!trimmedJourney.mass_kg && !trimmedJourney.containers) {
        throw new Error(
            `Missing mass_kg and containers on ${journey.shipment_id} - we need at least one.`,
        )
    }

    const journeyGroupedIntoLegs = groupJourneyIntoLegs(trimmedJourney)

    if (Object.keys(journeyGroupedIntoLegs).length > 10) {
        throw new Error(`Too many legs on ${journey.shipment_id} - max 10.`)
    }

    const parsedLegsArr = []
    for (const [number, leg] of Object.entries(journeyGroupedIntoLegs)) {
        const containsLocation =
            leg.street || leg.postcode || leg.city || leg.country || leg.coordinates
        const containsDistance = leg.distance_km
        // TODO see if this fallback is truly needed, it's possible it is
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const nextLegContainsDistance = journeyGroupedIntoLegs[parseInt(number) + 1]?.distance_km

        if (!containsLocation && !containsDistance && !nextLegContainsDistance) {
            throw new Error(
                `Missing (street, postcode, city, country) or (distance) or (coordinates) on ${journey.shipment_id} - leg ${number} - please provide one of those.
                 If this is the pickup point (leg zero) -> you can also provide distance_km on leg 1.`,
            )
        }

        if (number === '0') {
            continue
        }

        if (!leg.method && !leg.imo_number) {
            throw new Error(`Missing method/imo_number on leg ${number} of ${journey.shipment_id}`)
        }

        const route = leg.distance_km
            ? {
                  amount: leg.distance_km,
                  unit: Distance.unit.KM,
              }
            : {
                  source: mapLegToLocation(journeyGroupedIntoLegs[parseInt(number) - 1]),
                  destination: mapLegToLocation(leg),
              }

        parsedLegsArr.push({
            method: leg.imo_number
                ? { vesselImoNumber: leg.imo_number }
                : leg.method === 'container_ship'
                ? ({
                      vesselType: 'container_ship',
                  } as ContainerShippingMethod)
                : (leg.method as SimpleShippingMethod),
            ...(leg.country && { countryCode: leg.country }),
            route,
        })
    }

    return {
        shipment: trimmedJourney.mass_kg
            ? {
                  mass: {
                      amount: trimmedJourney.mass_kg,
                      unit: MassUnit.KG,
                  },
              }
            : {
                  containers: trimmedJourney.containers,
              },
        legs: parsedLegsArr,
    }
}

/**
 * Group the legs data from the journey returning a record like this:
 * {
 *   "1": {
 *     "method": "container_ship",
 *     "country": "DEU",
 *     "city": "Hamburg"
 *   },
 *   "2": {
 *     "method": "electric_freight_train",
 *     "country": "DEU",
 *     "city": "Philippsthal"
 *   }
 * }
 * @param journey
 */
function groupJourneyIntoLegs(journey: Record<string, string>): Record<number, LegFromCSV> {
    return Object.entries(journey).reduce((acc, [key, value]) => {
        if (key.includes('leg')) {
            // split only on first occurrence of '_'
            const [leg, field] = key.split(/_(.*)/s)
            const legNumber = leg.replace('leg', '')

            if (!legNumber) {
                throw new Error(`Could not parse leg number from key: ${key}`)
            }
            const legAsInt = parseInt(legNumber)
            acc[legAsInt] = {
                // acc[legAsInt] is always truthy per the type declarations
                // so there'a s linting error we need to silence.
                // TODO: Fix the types so this is not necessary
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                ...(acc[legAsInt] || {}),
                [field]: value,
            }
        }

        // Pickup entries server as leg 0
        if (key.includes('pickup_')) {
            const field = key.replace('pickup_', '')
            acc[0] = {
                // acc[legAsInt] is always truthy per the type declarations
                // so there'a s linting error we need to silence.
                // TODO: Fix the types so this is not necessary
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                ...(acc[0] || {}),
                [field]: value,
            }
        }

        return acc
    }, {} as Record<number, LegFromCSV>)
}

async function main(): Promise<void> {
    const pathToCSVFile = process.argv[2]
    if (!process.env.LUNE_API_KEY) {
        console.log('Please set the LUNE_API_KEY environment variable')
        return
    }

    if (!pathToCSVFile) {
        console.log('Please provide a path to a CSV file')
        return
    }

    const parsedCSV: any[] = await parseCSV(pathToCSVFile)
    const client = new LuneClient(process.env.LUNE_API_KEY)

    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
    progressBar.start(parsedCSV.length, 0)
    const estimates: EstimateResult[] = []
    for (const journey of parsedCSV) {
        const payload = buildEstimatePayload(journey)
        // An arbitrary starting point
        let retriesLeft = 10
        let delay = 50

        while (retriesLeft-- > 0) {
            const estimateResponse = await client.createMultiLegShippingEstimate(payload)
            if (estimateResponse.ok) {
                estimates.push(estimateResponse.unwrap())
                break
            }
            const apiError = estimateResponse.val
            const statusCode = apiError.statusCode
            const shouldRetry =
                retriesLeft > 0 &&
                // If we see no status code this means it's some kind of a communication error
                // and we have no reason not to retry.
                (!statusCode ||
                    // Server errors are likely to be temporary and it's safe to retry in that case
                    // too.
                    statusCode >= 500 ||
                    // We're hitting the API too fast, retry this one too (given we introduce some
                    // delay, of course, which we do))
                    statusCode === 429)
            // Other 4xx errors are definitely not good for retrying, they're a sign of
            // programming errors or input data issues and need to be fixed on our side.
            const description = [
                apiError.description,
                ...[
                    ...[
                        (apiError.errors?.errors ?? []).map(
                            ({ errorCode, message }) => `${errorCode}: ${message}`,
                        ),
                    ],
                ],
            ].join('; ')
            if (!shouldRetry) {
                console.log(`Failed to create estimate for ${journey.shipment_id}: `, description)
                // TODO: This type assertion shouldn't be necessary, we won't ever get
                // undefined here
                estimates.push({ err: description })
                break
            }

            // An exponential backoff with a limit, the more errors we hit the more API
            // call delay we add because we likely have either a case of a temporary server
            // failure (in which case if we wait the issue is likely to go away) or
            // we're hitting the rate limit (in which case we *need* to wait for the issue
            // to go away).
            delay = Math.min(delay * 2, 2000)
            console.log(
                `Waiting ${delay} ms to retry estimate for ${journey.shipment_id} (reason: ${description})`,
            )
            await sleep(delay)
        }
        progressBar.increment()
    }
    progressBar.stop()

    const argv = minimist(process.argv.slice(2))
    const nameOfCSVFile = path.parse(process.argv[2]).name
    const outputFilePath = `${argv.o || '.'}/${nameOfCSVFile}_${Date.now()}.csv`

    if (argv.o && !fs.existsSync(argv.o)) {
        fs.mkdirSync(argv.o, {
            recursive: true,
        })
    }

    writeResultsToCSV({
        inputs: parsedCSV,
        results: estimates,
        outputFilePath,
    })
}

main()
