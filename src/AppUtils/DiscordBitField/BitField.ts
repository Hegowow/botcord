// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck


export type BitFieldResolvable = number | string | bigint | BitField | BitFieldResolvable[];

export class BitField {
    static Flags = {};

    static DefaultBit = 0;

    constructor (bits = this.constructor.DefaultBit) {
        this.bitfield = this.constructor.resolve(bits);
    }

    any (bit) {
        return (this.bitfield & this.constructor.resolve(bit)) !== this.constructor.DefaultBit;
    }

    equals (bit) {
        return this.bitfield === this.constructor.resolve(bit);
    }

    has (bit) {
        const resolvedBit = this.constructor.resolve(bit);
        return (this.bitfield & resolvedBit) === resolvedBit;
    }

    missing (bits, ...hasParams) {
        return new this.constructor(bits).remove(this).toArray(...hasParams);
    }

    freeze () {
        return Object.freeze(this);
    }

    add (...bits) {
        let total = this.constructor.DefaultBit;
        for (const bit of bits) {
            total |= this.constructor.resolve(bit);
        }

        if (Object.isFrozen(this)) return new this.constructor(this.bitfield | total);
        this.bitfield |= total;
        return this;
    }

    remove (...bits) {
        let total = this.constructor.DefaultBit;
        for (const bit of bits) {
            total |= this.constructor.resolve(bit);
        }

        if (Object.isFrozen(this)) return new this.constructor(this.bitfield & ~total);
        this.bitfield &= ~total;
        return this;
    }

    serialize (...hasParams) {
        const serialized = {};
        for (const [flag, bit] of Object.entries(this.constructor.Flags)) {
            if (isNaN(flag)) serialized[flag] = this.has(bit, ...hasParams);
        }

        return serialized;
    }

    toArray (...hasParams) {
        return [...this[Symbol.iterator](...hasParams)];
    }

    toJSON () {
        return typeof this.bitfield === "number" ? this.bitfield : this.bitfield.toString();
    }

    valueOf () {
        return this.bitfield;
    }

    *[Symbol.iterator] (...hasParams) {
        for (const bitName of Object.keys(this.constructor.Flags)) {
            if (isNaN(bitName) && this.has(bitName, ...hasParams)) yield bitName;
        }
    }


    static resolve (bit) {
        const { DefaultBit } = this;
        if (typeof DefaultBit === typeof bit && bit >= DefaultBit) return bit;
        if (bit instanceof BitField) return bit.bitfield;
        if (Array.isArray(bit)) {
            return bit.map(bit_ => this.resolve(bit_)).reduce((prev, bit_) => prev | bit_, DefaultBit);
        }

        if (typeof bit === "string") {
            if (!isNaN(bit)) return typeof DefaultBit === "bigint" ? BigInt(bit) : Number(bit);
            if (this.Flags[bit] !== undefined) return this.Flags[bit];
        }

        throw new RangeError("BITFIELD_INVALID", bit);
    }
}
