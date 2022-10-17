lune-shipping-csv-tool
======================

<!-- README for NPM; the one for GitHub is in .github directory. -->

## Intro

This is a simple utility that will help to estimate CO2 emissions (caused by shipping goods for example) of multi-leg shipments.
This is done via using the [Lune API](https://docs.lune.co).

## How to install

This utility is a NodeJS application and you should be able to run it on variety of OSes.

To install this utility and start using it, first perform the following steps:

1. Install Node if you don't have it already: https://nodejs.org/en/
2. Install lune-shipping-csv-tool globally via running command `npm install -g lune-shipping-csv-tool` in a command-line interpreter 
(typically Terminal on OSX or Command Prompt on Windows)
3. If the installation was successfully you should be able to run `lune-csv-calculator` in the command-line interpreter although this
will result in an error `Please set API_KEY in .env`

## How to use

This utility is a CLI application that parses a CSV file, makes a request to the Lune API for each row, and outputs a 
new CSV file with the estimated CO2 emissions.

You will need a valid Lune API key (you can generate one from https://dashboard.lune.co/developers) - it doesn't matter if 
it's a live/test key.

You will also need to create a CSV input file. Please examine [this existing file](https://github.com/lune-climate/lune-shipping-csv-tool/blob/master/input/sampleInput.csv)
to understand the format.

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
`leg1_method` -> the method of transport for the leg. Optional if `leg1_imo_number` is provided. \
`leg1_country` -> the country code\
`leg1_city` -> the city\
`leg1_postcode` -> the postcode\
`leg1_street` -> the street\
`leg1_distance_km` -> optional. If provided, the tool will use this value instead of calculating it. Thus you can skip the address info.\
`leg1_imo_number` -> optional. If provided, the method of transportation will be calculated as IdentifiedVesselShippingMethod.

Documentation: https://docs.lune.co/resources/emission-estimates/create-multi-leg-shipping-estimate

Additionally, the following columns should be present but left empty:
`leg1_estimated_distance_km` -> the estimated distance of the leg in km. Populated by the tool after running
`leg1_total_tco2_` -> the estimated CO2 emissions of the leg in kg. Populated by the tool after running

You can provide up to 10 legs in this way. Checkout the sample input to get a better idea.

## Run a calculation

Create a CSV on your machine in some folder. Let's say it's `sampleInput.csv` within /downloads.\

Now start the command line interpreter within that folder. You will need to provide the API key 
as an environment variable `API_KEY` and also provide the path to the input file.
 
Here's what that looks like in the OSX terminal:
```bash
API_KEY=your_api_key_here lune-csv-calculator sampleInput.csv
```

And in the Windows command prompt:
```powershell
set API_KEY=your_api_key_here
lune-csv-calculator sampleInput.csv
```

The output file will then be created in the same folder and will contain a timestamp e.g. `downloads/sampleInput_1662112271931.csv`
The result is the same CSV file with the result columns filled in (checkout the [sample output file](https://github.com/lune-climate/lune-shipping-csv-tool/blob/master/output/sampleInput_1662043831339.csv)).
