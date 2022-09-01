import { createReadStream } from 'fs'
import { parse } from 'csv-parse'
import { parse as parseSync } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import fs from 'fs'
import { EstimateResult, LegFromCSV } from './types'
import { MultiLegShippingEmissionEstimate } from '@lune-climate/lune/esm/models/MultiLegShippingEmissionEstimate'
import { Address } from '@lune-climate/lune'

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

export const mapLegToAddress = (leg: LegFromCSV): Address => ({
    streetLine1: leg.street,
    city: leg.city,
    postcode: leg.postcode,
    countryCode: leg.country,
})

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

    if (!fs.existsSync('output')) {
        fs.mkdirSync('output')
    }

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

    const nameOfCSVFile = process.argv[2].replace('.csv', '')
    fs.writeFileSync(`output/${nameOfCSVFile}_${Date.now()}.csv`, stringify(parsedCSV))
}
