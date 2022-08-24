import { parseCsv } from './utils'

const main = async () => {
    const pathToShippingDataCSV = process.argv.slice(2)[0]
    const data = await parseCsv(pathToShippingDataCSV)
    console.log(`---data---`, data)
}

main()
