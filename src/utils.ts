import { createReadStream } from 'fs'
import fs from 'fs'

import {
    Address,
    GeographicCoordinates,
    MultiLegShippingEmissionEstimate,
} from '@lune-climate/lune'
import { parse } from 'csv-parse'
import { stringify } from 'csv-stringify/sync'

import { EstimateResult, LegFromCSV } from './types.js'

enum Column {
    ESTIMATE_ID = 'estimate_id',
    TOTAL_MASS_TCO2 = 'total_mass_tco2',
    TOTAL_DISTANCE_KM = 'total_distance_km',
    ERROR = 'error',
}

/**
 * Trim each key and value in the Record
 * Remove any entries with a falsy key or value (i.e. empty string or null)
 * @param journey
 */
export function trimAndRemoveEmptyEntries(journey: Record<string, string>): Record<string, string> {
    return Object.entries(journey).reduce(
        (acc, [key, value]) => {
            const trimmedKey = key.trim()
            const trimmedValue = value.trim()
            if (trimmedKey && trimmedValue) {
                acc[trimmedKey] = trimmedValue
            }
            return acc
        },
        {} as Record<string, string>,
    )
}

export function mapLegToLocation(leg: LegFromCSV): Address | GeographicCoordinates {
    if (leg.coordinates) {
        return parseCoordinates(leg.coordinates)
    } else {
        return {
            streetLine1: leg.street || '',
            city: leg.city || '',
            postcode: leg.postcode || '',
            countryCode: leg.country || '',
        }
    }
}

/**
 * Parse geographic coordinates from a string format used in the input CSV files.
 *
 * An invalid input will result in an exception.
 *
 * @param coordinates A string of the following form: "lat <number> lon <number>"
 */
export function parseCoordinates(coordinates: string): GeographicCoordinates {
    function bail(): never {
        throw new Error(
            `Coordinates must be formatted like this: "lat 12.345 lon -12.345", got: "${coordinates}"`,
        )
    }
    const parts = coordinates.split(' ')
    if (parts.length !== 4) {
        bail()
    }

    const [latLiteral, latText, lonLiteral, lonText] = parts
    if (latLiteral !== 'lat' || lonLiteral !== 'lon') {
        bail()
    }
    const lat = parseFloat(latText)
    const lon = parseFloat(lonText)
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
        bail()
    }
    return { lat, lon }
}

export async function parseCSV(filename: string): Promise<any[]> {
    const promise = new Promise((resolve, reject) => {
        createReadStream(filename).pipe(
            parse(
                {
                    columns: (header) => header,
                },
                (err, input) => (err ? reject(err) : resolve(input)),
            ),
        )
    })
    return (await promise) as any[]
}

export function writeResultsToCSV({
    inputs,
    results,
    outputFilePath,
}: {
    // TODO: Improve this type
    inputs: Record<string, string>[]
    results: EstimateResult[]
    outputFilePath: string
}): void {
    // We'll be modifying the inputs inside – deep copy them so that our
    // changes aren't visible outside this function.
    inputs = inputs.map((i) => ({ ...i }))

    results.forEach((result, index) => {
        const csvRow = inputs[index]

        if ((result as { err: string }).err) {
            csvRow[Column.ERROR] = (result as { err: string }).err
        } else {
            const estimate = result as MultiLegShippingEmissionEstimate
            csvRow[Column.ESTIMATE_ID] = estimate.id
            csvRow[Column.TOTAL_MASS_TCO2] = estimate.mass.amount
            csvRow[Column.TOTAL_DISTANCE_KM] = estimate.distance.amount

            estimate.legs.forEach((leg, legIndex) => {
                csvRow[`leg${legIndex + 1}_estimated_distance_km`] =
                    leg.distance !== undefined ? leg.distance.amount : ''
                csvRow[`leg${legIndex + 1}_total_tco2`] = leg.mass.amount
            })
        }
    })

    fs.writeFileSync(outputFilePath, stringify(inputs, { header: true }))
}

/**
 * Sleep for `ms` miliseconds.
 * @param ms The number of miliseconds to sleep.
 * @returns The promise that needs to be awaited to sleep.
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
