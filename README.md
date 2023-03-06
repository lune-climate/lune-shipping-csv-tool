lune-shipping-csv-tool
======================

[![CI](https://github.com/lune-climate/lune-shipping-csv-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/lune-climate/lune-shipping-csv-tool/actions/workflows/ci.yml)
[![NPM version](https://img.shields.io/npm/v/lune-shipping-csv-tool.svg)](https://npmjs.org/package/lune-shipping-csv-tool)
[![Coverage](https://codecov.io/github/lune-climate/lune-shipping-csv-tool/branch/master/graph/badge.svg?token=I0D88NXGB8)](https://codecov.io/github/lune-climate/lune-shipping-csv-tool)

Repository: https://github.com/lune-climate/lune-shipping-csv-tool

## Intro

This is a simple utility that will help to estimate CO2 emissions (caused by shipping goods for example) of multi-leg shipments.
This is done via using the [Lune API](https://docs.lune.co).

## Installing from NPM (AKA "I just want to use the application")

This is supported on Unix-like (Linux, BSD, macOS etc.) and Windows.

1. Install Node if you don't have it already: https://nodejs.org/en/
2. Install lune-shipping-csv-tool globally via running command `npm install -g lune-shipping-csv-tool` in a command-line interpreter 
(typically Terminal on OSX or Command Prompt on Windows)
3. If the installation was successfully you should be able to run `lune-shipping-csv-tool` in the command-line interpreter although this
will result in an error `Please set the LUNE_API_KEY environment variable`

Now follow the [How to use](#how-to-use) instructions.

Run `npm update -g lune-shipping-csv-tool` to update the tool to the latest version (note
that new versions may introduce some backwards-incompatible changes).

## Running the development version (AKA "I want to see how it works or make some changes")

This requires a Unix-like operating system (Linux, BSD, macOS, Windows with WSL etc.).

1. Clone this repository (https://github.com/lune-climate/lune-shipping-csv-tool)
2. Install Node if you don't have it already
3. Install a package manager if you don't have it already
4. Install all dependencies via  `npm install` or `yarn` depending on your package manager of choice
5. Run the utility via `npm run start` or `yarn start` depending on your package manager of choice

Now follow the [How to use](#how-to-use) instructions. Remember to mentally replace all
`lune-shipping-csv-tool` occurrences with `yarn start` (or `npm run start`, if you use `npm`) – you
are running the development version after all.

Run `git` commands to update the local clone of the repository with the latest upstream changes
(note that some of them may be backwards-incompatible).

## How to use

This utility is a CLI application that parses a CSV file, makes a request to the Lune API for each row, and outputs a 
new CSV file with the estimated CO2 emissions.

You will need a valid Lune API key (you can generate one from https://dashboard.lune.co/developers) - it doesn't matter if 
it's a live/test key. The application expects the API key to be provided to it via an `LUNE_API_KEY`
environment variable:

```
# Unix-like
export LUNE_API_KEY=<the API key secret goes here>

# Windows
set LUNE_API_KEY=<The API key secret goes here>
```

You will also need to create a CSV input file. Please examine [this existing file](https://github.com/lune-climate/lune-shipping-csv-tool/blob/master/input/sampleInput.csv)
to understand the format. We have documented [The CSV Input format](#the-csv-input-format).

Then to actually run the tool:

```bash
lune-shipping-csv-tool <path to the input CSV file>
```

The output file will appear in the current directory. If you want to define the output directory:

```bash
lune-shipping-csv-tool <path to the input CSV file> -o <path to the output directory>
```

## The CSV Input format

Each row in the CSV file represents a multi-leg journey. The following columns are always present: 

* `shipment_id` -> a unique identifier for the shipment
* `estimate_id` -> a unique identifier for the estimate: populated by the tool after running
* `total_mass_tco2`-> the total estimated CO2 emissions for the shipment: populated by the tool after running
* `total_distance_km` -> the total distance of the shipment in km: populated by the tool after running
* `error` -> any error that occurred while processing the shipment: populated by the tool after running
* `mass_kg` / `containers` -> only provide one of these two columns. `mass_kd` represents the total mass of the shipment in kg. while `containers` represents the number of containers in the shipment.
* `pickup_country`-> start point of the journey
* `pickup_city` -> start city of the journey
* `pickup_postcode` -> postcode of the start city
* `pickup_street` -> street of the start of the journey
* `pickup_coordinates` -> the geopgrahic coordinates of the pickup location

Additionally, you need to provide at least a single leg of the journey. The following columns are required for each leg:

* `leg1_method` -> the method of transport for the leg. Optional if `leg1_imo_number` is provided.
* `leg1_country` -> the country code
* `leg1_city` -> the city
* `leg1_postcode` -> the postcode
* `leg1_street` -> the street
* `leg1_coordinates` -> the geographic coordinates of the location
* `leg1_distance_km` -> optional. If provided, the tool will use this value instead of calculating it. Thus you can skip the address info.
* `leg1_imo_number` -> optional. If provided, the method of transportation will be calculated as IdentifiedVesselShippingMethod.

The `_coordinates` fields are mutually exclusive with (`_country`, `_city`, `_postcode`,
`_street`) – you can provide only one or the other.

Documentation: https://docs.lune.co/resources/emission-estimates/create-multi-leg-shipping-estimate

Additionally, the following columns should be present but left empty:

* `leg1_estimated_distance_km` -> the estimated distance of the leg in km. Populated by the tool after running
* `leg1_total_tco2_` -> the estimated CO2 emissions of the leg in kg. Populated by the tool after running

You can provide up to 10 legs in this way. Checkout the sample input to get a better idea.
