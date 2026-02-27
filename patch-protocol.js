const fs = require('fs');

let protocolCode = fs.readFileSync('src/zNEP17.Protocol/zNEP17Protocol.cs', 'utf8');

protocolCode = protocolCode.replace(
    `    public static void UpdateMerkleRoot(byte[] newRoot, BigInteger expectedLeafCount)
    {
        int rootLength = newRoot is null ? 0 : newRoot.Length;
        ExecutionEngine.Assert(rootLength == PrivacyGuards.MerkleRootLength, "invalid root length");
        ExecutionEngine.Assert(newRoot is not null, "root cannot be null");
        ExecutionEngine.Assert(expectedLeafCount >= 0, "invalid expected leaf count");

        UInt160 maintainer = GetTreeMaintainer();
        ExecutionEngine.Assert(maintainer.IsValidAndNotZero, "tree maintainer not configured");
        ExecutionEngine.Assert(Runtime.CheckWitness(maintainer), "forbidden tree maintainer");

        BigInteger leafCount = GetLeafIndex();
        ExecutionEngine.Assert(expectedLeafCount == leafCount, "leaf count changed");
        BigInteger lastRootLeafCount = GetLastRootLeafCount();
        ExecutionEngine.Assert(leafCount >= lastRootLeafCount, "leaf count regression");
        ExecutionEngine.Assert(
            leafCount > lastRootLeafCount || GetCurrentRoot().Length == 0,
            "root already updated for current leaf count");
        ExecutionEngine.Assert(RootMap().Get(newRoot!) is null, "root already known");

        Storage.Put(KeyCurrentRoot, newRoot!);
        RootMap().Put(newRoot!, true);
        RootLeafCountMap().Put(newRoot!, leafCount);
        Storage.Put(KeyLastRootLeafCount, leafCount);
        RootHistoryMap().Put(leafCount.ToByteArray(), newRoot!);
        PruneOldRootHistory(leafCount);

        OnMerkleRootUpdated(newRoot!, leafCount);
    }`,
    `    public static void UpdateMerkleRoot(byte[] proof, byte[] publicInputs, byte[] newRoot)
    {
        int rootLength = newRoot is null ? 0 : newRoot.Length;
        ExecutionEngine.Assert(rootLength == PrivacyGuards.MerkleRootLength, "invalid root length");
        ExecutionEngine.Assert(newRoot is not null, "root cannot be null");
        ExecutionEngine.Assert(proof is not null && proof.Length == 192, "invalid proof");
        ExecutionEngine.Assert(publicInputs is not null && publicInputs.Length == 160, "invalid public inputs");

        BigInteger lastRootLeafCount = GetLastRootLeafCount();
        BigInteger leafCount = GetLeafIndex();
        ExecutionEngine.Assert(lastRootLeafCount < leafCount, "no new leaves to update");

        byte[] oldRoot = GetCurrentRoot();
        if (oldRoot.Length == 0)
        {
            oldRoot = Convert.FromHexString("500d7edac24935fb5738441c8f3778bcb71449c552c756383dc986dc499d6322");
        }

        BigInteger updateIndex = lastRootLeafCount; // The index of the leaf being updated (0-based)
        byte[] oldLeaf = new byte[32]; // 0n
        byte[] newLeaf = GetLeaf(updateIndex);
        
        UInt160 verifier = GetVerifier();
        ExecutionEngine.Assert(verifier.IsValidAndNotZero, "verifier not configured");

        bool result = (bool)Contract.Call(
            verifier,
            "verifyTreeUpdate",
            CallFlags.ReadOnly,
            proof,
            publicInputs,
            oldRoot,
            newRoot,
            oldLeaf,
            newLeaf,
            updateIndex);

        ExecutionEngine.Assert(result, "invalid tree update proof");
        
        ExecutionEngine.Assert(RootMap().Get(newRoot!) is null, "root already known");

        Storage.Put(KeyCurrentRoot, newRoot!);
        RootMap().Put(newRoot!, true);
        BigInteger newRootLeafCount = updateIndex + 1;
        RootLeafCountMap().Put(newRoot!, newRootLeafCount);
        Storage.Put(KeyLastRootLeafCount, newRootLeafCount);
        RootHistoryMap().Put(newRootLeafCount.ToByteArray(), newRoot!);
        PruneOldRootHistory(newRootLeafCount);

        OnMerkleRootUpdated(newRoot!, newRootLeafCount);
    }`
);

// Remove GetTreeMaintainer
protocolCode = protocolCode.replace(
`    [Safe]
    public static UInt160 GetTreeMaintainer()
    {
        ByteString? maintainer = Storage.Get(KeyTreeMaintainer);
        return maintainer is null ? UInt160.Zero : (UInt160)(byte[])maintainer;
    }`, ``);

// Remove SetTreeMaintainer
protocolCode = protocolCode.replace(
`    public static void SetTreeMaintainer(UInt160 maintainer)
    {
        ExecutionEngine.Assert(maintainer.IsValidAndNotZero, "invalid maintainer address");
        AssertOwnerWitness();
        Storage.Put(KeyTreeMaintainer, (byte[])maintainer);
    }`, ``);

// Remove KeyTreeMaintainer
protocolCode = protocolCode.replace(/private static readonly byte\[\] KeyTreeMaintainer = new byte\[\] \{ 0x1C \};\n/, '');

// Remove TreeMaintainer from test
fs.writeFileSync('src/zNEP17.Protocol/zNEP17Protocol.cs', protocolCode);
