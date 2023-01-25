#!/usr/bin/env node
import {
    ContainerShippingMethod,
    Distance,
    LuneClient,
    MassUnit,
    SimpleShippingMethod,
} from '@lune-climate/lune'
import { mapLegToLocation, parseCSV, trimAndRemoveEmptyEntries, writeResultsToCSV } from './utils'
import 'dotenv/config'
import { ApiError } from '@lune-climate/lune/cjs/core/ApiError'
import { estimatePayload, EstimateResult, LegFromCSV } from './types'

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
        const containsLocation = leg.street || leg.postcode || leg.city || leg.country || leg.coordinates
        const containsDistance = leg.distance_km
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
    const pathToCSVFile = process.argv[2]
    if (!process.env.API_KEY) {
        console.log('Please set API_KEY in .env')
        return
    }

    if (!pathToCSVFile) {
        console.log('Please provide a path to a CSV file')
        return
    }

    const parsedCSV: any[] = await parseCSV(pathToCSVFile)
    const client = new LuneClient(process.env.API_KEY)

    const estimates: EstimateResult[] = []
    for (const journey of parsedCSV) {
        const payload = buildEstimatePayload(journey)
        const estimateResponse = await client.createMultiLegShippingEstimate(payload)
        if (estimateResponse.err) { 
            const apiError = estimateResponse.val
            const description = (apiError as ApiError)?.description || apiError.errors?.errors[0].toString()
            console.log(`Failed to create estimate for ${journey.shipment_id}: `, description)
            // TODO: This type assertion shouldn't be necessary, we won't ever get
            // undefined here
            estimates.push({ err: description as string })
            continue
        }
        estimates.push(estimateResponse.unwrap())
    }

    writeResultsToCSV({
        pathToShippingDataCSV: pathToCSVFile,
        results: estimates,
    })
}

main()
