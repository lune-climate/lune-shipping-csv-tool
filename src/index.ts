import { Distance, LuneClient, MassUnit, SimpleShippingMethod } from '@lune-climate/lune'
import { mapLegToAddress, parseCSV, trimAndRemoveEmptyEntries, writeResultsToCSV } from './utils'
import 'dotenv/config'
import { ApiError } from '@lune-climate/lune/cjs/core/ApiError'
import { estimatePayload, EstimateResult, LegFromCSV } from './types'
import minimist from 'minimist'

/**
 * Takes one journey (a single row from CSV)
 * Returns a payload object { shipment, legs } ready for Lune API createMultiLegShippingEstimate method
 * @param journey
 */
const buildEstimatePayload = (journey: Record<string, string>): estimatePayload => {
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
        const containsAddress = leg.street && leg.postcode && leg.city && leg.country
        const containsDistance = leg.distance_km
        const nextLegContainsDistance = journeyGroupedIntoLegs[parseInt(number) + 1]?.distance_km

        if (!containsAddress && !containsDistance && !nextLegContainsDistance) {
            throw new Error(
                `Missing (street, postcode, city, country) or (distance) on ${journey.shipment_id} - leg ${number} - please provide one of those.
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
                  source: mapLegToAddress(journeyGroupedIntoLegs[parseInt(number) - 1]),
                  destination: mapLegToAddress(leg),
              }

        parsedLegsArr.push({
            method: leg.imo_number
                ? { vesselImoNumber: leg.imo_number }
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
const groupJourneyIntoLegs = (journey: Record<string, string>): Record<number, LegFromCSV> =>
    Object.entries(journey).reduce((acc, [key, value]) => {
        if (key.includes('leg')) {
            // split only on first occurrence of '_'
            const [leg, field] = key.split(/_(.*)/s)
            const legNumber = leg.replace('leg', '')

            if (!legNumber) {
                throw new Error(`Could not parse leg number from key: ${key}`)
            }
            const legAsInt = parseInt(legNumber)
            acc[legAsInt] = {
                ...(acc[legAsInt] || {}),
                [field]: value,
            }
        }

        // Pickup entries server as leg 0
        if (key.includes('pickup_')) {
            const field = key.replace('pickup_', '')
            acc[0] = {
                ...(acc[0] || {}),
                [field]: value,
            }
        }

        return acc
    }, {} as Record<number, LegFromCSV>)

const main = async () => {
    const argv = minimist(process.argv.slice(2))
    const pathToCSVFile = argv.p
    if (!pathToCSVFile || !process.env.API_KEY) {
        console.log('Please set API_KEY in .env and pass the path to CSV file as an argument.')
        return
    }

    const pathToShippingDataCSV = `${pathToCSVFile.replace('.csv', '')}.csv`

    const parsedCSV: any[] = await parseCSV(pathToShippingDataCSV)
    const client = new LuneClient(process.env.API_KEY)

    const estimates: EstimateResult[] = await Promise.all(
        parsedCSV.map(async (journey) => {
            let payload
            try {
                payload = buildEstimatePayload(journey)
                const estimateResponse = await client.createMultiLegShippingEstimate(payload)
                if (estimateResponse.err) {
                    throw new Error(
                        (estimateResponse.val as ApiError)?.description ||
                            estimateResponse?.val?.errors?.errors[0].toString(),
                    )
                }
                return estimateResponse.unwrap()
            } catch (e) {
                console.log(`Failed to create estimate for ${journey.shipment_id}: `, e)
                return { err: (e as Error).message }
            }
        }),
    )

    writeResultsToCSV({
        pathToShippingDataCSV,
        results: estimates,
    })
}

main()
