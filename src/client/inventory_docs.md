# Inventory

## On Disk Caches

LocalInventoryClient has 3 on disk caches to speed up startup and remove the need to read in lots of file to get their values.

### filesCache.json / "this.files"

An unordered mapping of:

```
{
    <first>: {
        hash: <hash>,
        n: <n>
    },
    ...
}
```

Where for every line, <first> is the first twist in that line, <hash> is the latest twist in the line, and <n> is the number of twists in that line.

### twistIdxCache.json / "this.twistIdx"

An unordered mapping of:

```
{
    <hash>: <first>,
    ...
}
```

For every twist in every line, map the hash of each twist to the first twist in that line.

### dqCache.json / this.dqCache

A persistent and in-memory cache of DQ information owned by a client.

Stored structure:

```
{
    <fileHash>: <DQInfo>,
    ...
}
```

Where DQInfo is an object as follows:
@typedef {Object} DQInfo
@property {Number} displayPrecision
@property {Number} quantity
@property {Hash} rootId
@property {Hash} poptop
