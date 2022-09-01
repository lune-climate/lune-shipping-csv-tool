import { Address, Distance, LuneClient, MassUnit, SimpleShippingMethod } from '@lune-climate/lune'
import { parseCSV, writeResultsToCSV } from './utils'
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
        if (!(leg.street && leg.postcode && leg.city && leg.country) && !leg.distance_km) {
            throw new Error(
                `Missing (street, postcode, city, country) or (distance) on ${journey.shipment_id} - leg ${number} - please provide one of those.`,
            )
        }

        if (number === '0') {
            continue
        }

        if (!leg.method) {
            throw new Error(`Missing method on leg ${number} of ${journey.shipment_id}`)
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
            method: leg.method as SimpleShippingMethod,
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
            const [leg, field] = key.split('_')
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

/**
 * Trim each key and value in the Record
 * Remove any entries with a falsy key or value (i.e. empty string or null)
 * @param journey
 */
const trimAndRemoveEmptyEntries = (journey: Record<string, string>) =>
    Object.entries(journey).reduce((acc, [key, value]) => {
        const trimmedKey = key.trim()
        const trimmedValue = value.trim()
        if (trimmedKey && trimmedValue) {
            acc[trimmedKey] = trimmedValue
        }
        return acc
    }, {} as Record<string, string>)

const mapLegToAddress = (leg: LegFromCSV): Address => ({
    streetLine1: leg.street,
    city: leg.city,
    postcode: leg.postcode,
    countryCode: leg.country,
})

const main = async () => {
    if (!process.env.NAME_OF_CSV_FILE || !process.env.API_KEY) {
        console.log('Please set NAME_OF_CSV_FILE and API_KEY in .env')
        return
    }
    const pathToShippingDataCSV = `./input/${process.env.NAME_OF_CSV_FILE.replace('.csv', '')}.csv`
    const parsedCSV: any[] = await parseCSV(pathToShippingDataCSV)
    const client = new LuneClient(process.env.API_KEY)

    const estimates: EstimateResult[] = await Promise.all(
        parsedCSV.map(async (journey) => {
            let payload
            try {
                payload = buildEstimatePayload(journey)
                const estimateResponse = await client.createMultiLegShippingEstimate(payload)
                if (estimateResponse.err) {
                    throw new Error((estimateResponse.val as ApiError).errors?.toString())
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
