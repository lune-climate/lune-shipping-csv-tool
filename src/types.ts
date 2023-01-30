import { MultiLegShippingEmissionEstimate } from '@lune-climate/lune/esm/models/MultiLegShippingEmissionEstimate'
import { Shipment } from '@lune-climate/lune/esm/models/Shipment'
import { ShippingCountryCode } from '@lune-climate/lune/esm/models/ShippingCountryCode'
import { ShippingMethod } from '@lune-climate/lune/esm/models/ShippingMethod'
import { ShippingRoute } from '@lune-climate/lune/esm/models/ShippingRoute'

export type estimatePayload = {
    shipment: Shipment
    legs: { route: ShippingRoute; method: ShippingMethod; countryCode?: ShippingCountryCode }[]
}

export type LegFromCSV = {
    method: string
    imo_number: string
    country: string
    city: string
    street: string
    distance_km: string
    postcode: string
    coordinates: string
}

export type EstimateResult = MultiLegShippingEmissionEstimate | { err: string }
