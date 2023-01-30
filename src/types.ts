import {
    MultiLegShippingEmissionEstimate,
    Shipment,
    ShippingCountryCode,
    ShippingMethod,
    ShippingRoute,
} from '@lune-climate/lune'

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
