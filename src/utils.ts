import { createReadStream } from 'fs'
import { parse } from 'csv-parse'
import { parse as parseSync } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import fs from 'fs'
import { EstimateResult, LegFromCSV } from './types'
import { MultiLegShippingEmissionEstimate } from '@lune-climate/lune/esm/models/MultiLegShippingEmissionEstimate'
import { Address, GeographicCoordinates } from '@lune-climate/lune'
import path from 'path'
import minimist from 'minimist'

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
export const trimAndRemoveEmptyEntries = (journey: Record<string, string>) =>
    Object.entries(journey).reduce((acc, [key, value]) => {
        const trimmedKey = key.trim()
        const trimmedValue = value.trim()
        if (trimmedKey && trimmedValue) {
            acc[trimmedKey] = trimmedValue
        }
        return acc
    }, {} as Record<string, string>)

export const mapLegToLocation = (leg: LegFromCSV): Address | GeographicCoordinates => {
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
function parseCoordinates(coordinates: string): GeographicCoordinates {
    function bail() {
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

export async function parseCSV(filename: string) {
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
    pathToShippingDataCSV,
    results,
}: {
    pathToShippingDataCSV: string
    results: EstimateResult[]
}) {
    const parsedCSV = parseSync(fs.readFileSync(pathToShippingDataCSV))

    const header = parsedCSV[0]
    const estimateIdIndex = header.indexOf(Column.ESTIMATE_ID)
    const totalMassIndex = header.indexOf(Column.TOTAL_MASS_TCO2)
    const totalDistanceIndex = header.indexOf(Column.TOTAL_DISTANCE_KM)
    const errorIndex = header.indexOf(Column.ERROR)

    if (
        estimateIdIndex === -1 ||
        totalMassIndex === -1 ||
        totalDistanceIndex === -1 ||
        errorIndex === -1
    ) {
        throw new Error(
            `Could not find one of the following required columns in Input CSV: ${Object.keys(
                Column,
            ).join(', ')}`,
        )
    }

    results.forEach((result, index) => {
        const csvRow = parsedCSV[index + 1]

        if ((result as { err: string }).err) {
            csvRow[errorIndex] = (result as { err: string }).err
        } else {
            const estimate = result as MultiLegShippingEmissionEstimate
            csvRow[estimateIdIndex] = estimate.id
            csvRow[totalMassIndex] = estimate.mass.amount
            csvRow[totalDistanceIndex] = estimate.distance.amount

            estimate.legs.forEach((leg, legIndex) => {
                const indexOfLegEstimatedDistance = header.indexOf(
                    `leg${legIndex + 1}_estimated_distance_km`,
                )
                const indexOfLegEstimatedMass = header.indexOf(`leg${legIndex + 1}_total_tco2`)

                if (indexOfLegEstimatedDistance === -1 || indexOfLegEstimatedMass === -1) {
                    throw new Error(
                        `Could not one or more of required leg estimate result columns: ${indexOfLegEstimatedDistance} ${indexOfLegEstimatedMass}`,
                    )
                }

                csvRow[indexOfLegEstimatedDistance] = leg.distance.amount
                csvRow[indexOfLegEstimatedMass] = leg.mass.amount
            })
        }
    })

    const argv = minimist(process.argv.slice(2))
    const nameOfCSVFile = path.parse(process.argv[2]).name

    if (argv.o && !fs.existsSync(argv.o)) {
        fs.mkdirSync(argv.o, {
            recursive: true,
        })
    }

    fs.writeFileSync(`${argv.o || '.'}/${nameOfCSVFile}_${Date.now()}.csv`, stringify(parsedCSV))
}

/**
 * Sleep for `ms` miliseconds.
 * @param ms The number of miliseconds to sleep.
 * @returns The promise that needs to be awaited to sleep.
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
