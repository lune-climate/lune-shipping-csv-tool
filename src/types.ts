import { Shipment } from '@lune-climate/lune/esm/models/Shipment'
import { ShippingRoute } from '@lune-climate/lune/esm/models/ShippingRoute'
import { ShippingMethod } from '@lune-climate/lune/esm/models/ShippingMethod'
import { ShippingCountryCode } from '@lune-climate/lune/esm/models/ShippingCountryCode'

export type estimatePayload = {
    shipment: Shipment
    legs: { route: ShippingRoute; method: ShippingMethod; countryCode?: ShippingCountryCode }[]
}

export type LegFromCSV = {
    method: string
    country: string
    city: string
    street: string
    distance: string
    postcode: string
}
