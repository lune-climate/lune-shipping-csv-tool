import { createReadStream } from 'fs'
import { parse } from 'csv-parse'

export async function parseCsv(filename: string) {
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
