import re

filepath = 'src/zNEP17.Protocol/zNEP17Protocol.cs'
with open(filepath, 'r') as f:
    content = f.read()

# Modify UpdateMerkleRoot
update_root_orig = """    public static void UpdateMerkleRoot(byte[] newRoot, BigInteger expectedLeafCount)
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
    }"""

update_root_new = """    public static void UpdateMerkleRoot(byte[] newRoot, BigInteger expectedLeafCount)
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
        
        // Optimistic Rollup: Record the timestamp when the root was submitted instead of `true`
        RootMap().Put(newRoot!, Runtime.Time);
        
        RootLeafCountMap().Put(newRoot!, leafCount);
        Storage.Put(KeyLastRootLeafCount, leafCount);
        RootHistoryMap().Put(leafCount.ToByteArray(), newRoot!);
        PruneOldRootHistory(leafCount);

        OnMerkleRootUpdated(newRoot!, leafCount);
    }
    
    public static void RevokeMerkleRoot(byte[] root)
    {
        AssertSecurityCouncilWitness();
        ExecutionEngine.Assert(root is not null && root.Length == PrivacyGuards.MerkleRootLength, "invalid root");
        ByteString? submissionTime = RootMap().Get(root!);
        ExecutionEngine.Assert(submissionTime is not null, "root not found");
        
        // Mark as permanently invalid (0)
        RootMap().Put(root!, 0);
    }"""

content = content.replace(update_root_orig, update_root_new)

# Modify IsKnownRoot
is_known_orig = """    public static bool IsKnownRoot(byte[] root)
    {
        if (root is null || root.Length != PrivacyGuards.MerkleRootLength)
            return false;

        return RootMap().Get(root) is not null;
    }"""

is_known_new = """    public static bool IsKnownRoot(byte[] root)
    {
        if (root is null || root.Length != PrivacyGuards.MerkleRootLength)
            return false;

        ByteString? submissionTimeStr = RootMap().Get(root);
        if (submissionTimeStr is null)
            return false;
            
        BigInteger submissionTime = (BigInteger)submissionTimeStr;
        if (submissionTime == 0) return false; // Revoked
        
        return Runtime.Time >= submissionTime + PrivacyGuards.RootUpdateDelaySeconds;
    }"""

content = content.replace(is_known_orig, is_known_new)

with open(filepath, 'w') as f:
    f.write(content)

