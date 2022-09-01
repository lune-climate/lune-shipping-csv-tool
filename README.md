lune-shipping-csv-tool
======================

## Intro

This is a simple utility that will help to estimate CO2 emissions (caused by shipping goods for example) of multi-leg shipments.
This is done via using the [Lune API](https://docs.lune.co/api-reference/endpoints-emission-estimates.html#get-a-multi-leg-shipping-emission-estimate).

## How to install

This utility is a NodeJS application and you should be able to run it on variety of OSes.

To install this utility and start using it, first perform the following steps:

1. Clone this repository
2. Install Node if you don't have it already
3. Install a package manager if you don't have it already
4. Install all dependencies via  `npm install` or `yarn` depending on your package manager of choice
5. Run the utility via `npm run start` or `yarn start` depending on your package manager of choice

## How to use

This utility is a CLI application that parses a CSV file, makes a request to the Lune API for each row, and outputs a 
new CSV file with the estimated CO2 emissions.

You will need a valid Lune API (you can generate one from https://dashboard.lune.co/developers) - it doesn't matter if 
it's a live/test key. You should page the key in the .env file in the root of the project.

You will also need to create a CSV input file within the /input folder. Please examine the existing file `input/sampleInput.csv`
to see the format of the file.

## The CSV Input format

Each row in the CSV file represents a multi-leg journey. The following columns are always present: 

`shipment_id` -> a unique identifier for the shipment \
`estimate_id` -> a unique identifier for the estimate: populated by the tool after running \ 	
`total_mass_tco2`-> the total estimated CO2 emissions for the shipment: populated by the tool after running \ 
`total_distance_km` -> the total distance of the shipment in km: populated by the tool after running \
`error` -> any error that occurred while processing the shipment: populated by the tool after running \ 	
`mass_kg` / `containers` -> only provide one of these two columns. `mass_kd` represents the total mass of the shipment in kg. while `containers` represents the number of containers in the shipment. \
`pickup_country`-> start point of the journey \ 	
`pickup_city` -> start city of the journey \
`pickup_postcode` -> postcode of the start city \	
`pickup_street` -> street of the start of the journey \

Additionally, you need to provide at least a single leg of the journey. The following columns are required for each leg:
`leg1_method` -> the method of transport for the leg. Optional if `leg1_imo_number` is provided. See https://docs.lune.co/api-reference/simpleshippingmethod.html \
`leg1_country` -> the country code\
`leg1_city` -> the city\
`leg1_postcode` -> the postcode\
`leg1_street` -> the street\
`leg1_distance_km` -> optional. If provided, the tool will use this value instead of calculating it. Thus you can skip the address info.\
`leg1_imo_number` -> optional. If provided, the method of transportation will be calculated as IdentifiedVesselShippingMethod. See https://docs.lune.co/api-reference/identifiedvesselshippingmethod.html#identifiedvesselshippingmethod \

Additionally, the following columns should be present by left empty:
`leg1_estimated_distance_km` -> the estimated distance of the leg in km. Populated by the tool after running
`leg1_total_tco2_` -> the estimated CO2 emissions of the leg in kg. Populated by the tool after running

You can provide up to 10 legs in this way. Checkout the sample input to get a better idea.

## Run a calculation

Once you've installed everything you should be able to run the utility like so:
```bash
yarn start sampleInput.csv
```
where `sampleInput.csv` is the name of the input file you want to process. The output file will be created in the /output folder.
It's the same CSV file with the result columns filled in (checkout the sample output file).
