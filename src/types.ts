import { Shipment } from '@lune-climate/lune/esm/models/Shipment'
import { ShippingRoute } from '@lune-climate/lune/esm/models/ShippingRoute'
import { ShippingMethod } from '@lune-climate/lune/esm/models/ShippingMethod'
import { ShippingCountryCode } from '@lune-climate/lune/esm/models/ShippingCountryCode'
import { MultiLegShippingEmissionEstimate } from '@lune-climate/lune/esm/models/MultiLegShippingEmissionEstimate'

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
}

export type EstimateResult = MultiLegShippingEmissionEstimate | { err: string }
