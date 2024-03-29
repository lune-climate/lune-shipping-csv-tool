import { parseCoordinates } from './utils.js'

describe('parseCoordinates', () => {
    test('Should parse valid input correctly', () => {
        expect(parseCoordinates('lat 12.34 lon 56.78')).toEqual({
            lat: 12.34,
            lon: 56.78,
        })
    })

    test.each([
        'bleh',
        'lat lon',
        'lat 12 lon',
        'lat lon 12',
        'lat 12 lon a',
        'lat a lon 12',
        'lat 12 lon 12 foo',
        'a b c d',
    ])('Should reject invalid inputs', (input) => {
        expect(() => parseCoordinates(input)).toThrow()
    })
})
