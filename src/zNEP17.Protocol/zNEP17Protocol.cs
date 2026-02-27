using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;
using System.Numerics;
using System.ComponentModel;

namespace zNEP17.Protocol;

[ManifestExtra("Author", "R3E Network")]
[ManifestExtra("Description", "zNEP-17 privacy vault for Neo N3 with zk-SNARK based private transfers.")]
[ManifestExtra("Version", "0.1.0")]
[SupportedStandards("zNEP-17")]
[ContractPermission(Permission.Any, "transfer", "verify", "verifyTreeUpdate")]
public class zNEP17Protocol : SmartContract
{
    public delegate void PrivacyDepositDelegate(UInt160 asset, UInt160 stealthAddress, BigInteger amount, byte[] leaf, BigInteger index);
    public delegate void PrivacyWithdrawDelegate(UInt160 asset, UInt160 recipient, BigInteger amount, byte[] nullifier);
    public delegate void OwnershipTransferredDelegate(UInt160 previousOwner, UInt160 newOwner);
    public delegate void PausedDelegate(bool isPaused);
    public delegate void MerkleRootUpdatedDelegate(byte[] newRoot, BigInteger leafCount);
    public delegate void SecurityCouncilUpdatedDelegate(UInt160 previousCouncil, UInt160 newCouncil);

    [DisplayName("PrivacyDeposit")]
    public static event PrivacyDepositDelegate OnPrivacyDeposit = null!;

    [DisplayName("PrivacyWithdraw")]
    public static event PrivacyWithdrawDelegate OnPrivacyWithdraw = null!;

    [DisplayName("OwnershipTransferred")]
    public static event OwnershipTransferredDelegate OnOwnershipTransferred = null!;

    [DisplayName("Paused")]
    public static event PausedDelegate OnPaused = null!;

    [DisplayName("MerkleRootUpdated")]
    public static event MerkleRootUpdatedDelegate OnMerkleRootUpdated = null!;

    [DisplayName("SecurityCouncilUpdated")]
    public static event SecurityCouncilUpdatedDelegate OnSecurityCouncilUpdated = null!;

    private const byte PrefixRoots = 0x01;
    private const byte PrefixNullifiers = 0x02;
    private const byte PrefixLeaves = 0x03;
    private const byte PrefixAssetBalances = 0x04;
    private const byte PrefixRootHistory = 0x05;
    private const byte PrefixCommitmentIndices = 0x06;
    private const byte PrefixSpentCommitments = 0x07;
    private const byte PrefixAllowedAssets = 0x09;
    private const byte PrefixRootLeafCounts = 0x0B;
    private static readonly byte[] KeyOwner = new byte[] { 0x10 };
    private static readonly byte[] KeyVerifier = new byte[] { 0x11 };
    private static readonly byte[] KeyLeafIndex = new byte[] { 0x12 };
    private static readonly byte[] KeyCurrentRoot = new byte[] { 0x13 };
    private static readonly byte[] KeyPendingOwner = new byte[] { 0x14 };
    private static readonly byte[] KeyPaused = new byte[] { 0x15 };
    private static readonly byte[] KeyRelayer = new byte[] { 0x16 };
    private static readonly byte[] KeyPendingVerifier = new byte[] { 0x17 };
    private static readonly byte[] KeyPendingVerifierReadyAt = new byte[] { 0x18 };
    private static readonly byte[] KeyPendingRelayer = new byte[] { 0x19 };
    private static readonly byte[] KeyPendingRelayerReadyAt = new byte[] { 0x1A };
    private static readonly byte[] KeySecurityCouncil = new byte[] { 0x1B };
        private static readonly byte[] KeyPendingSecurityCouncil = new byte[] { 0x1E };
    private static readonly byte[] KeyPendingSecurityCouncilReadyAt = new byte[] { 0x1F };
    private static readonly byte[] KeyLastRootLeafCount = new byte[] { 0x20 };

    public static void _deploy(object data, bool update)
    {
        if (update)
            return;

        UInt160 owner = Runtime.Transaction.Sender;
        Storage.Put(KeyOwner, (byte[])owner);
        Storage.Put(KeyLeafIndex, 0);
        Storage.Put(KeyPaused, 0); // 0 = false
    }

    [Safe]
    public static bool IsPaused()
    {
        ByteString? paused = Storage.Get(KeyPaused);
        return paused is not null && paused != ByteString.Empty && paused[0] != 0;
    }

    public static void SetPaused(bool paused)
    {
        AssertOwnerWitness();
        Storage.Put(KeyPaused, paused ? new byte[] { 1 } : new byte[] { 0 });
        OnPaused(paused);
    }

    [Safe]
    public static UInt160 GetOwner()
    {
        ByteString? owner = Storage.Get(KeyOwner);
        return owner is null ? UInt160.Zero : (UInt160)(byte[])owner;
    }

    [Safe]
    public static UInt160 GetPendingOwner()
    {
        ByteString? pending = Storage.Get(KeyPendingOwner);
        return pending is null ? UInt160.Zero : (UInt160)(byte[])pending;
    }

    public static void TransferOwnership(UInt160 newOwner)
    {
        ExecutionEngine.Assert(newOwner.IsValidAndNotZero, "invalid new owner address");
        AssertOwnerWitness();
        Storage.Put(KeyPendingOwner, (byte[])newOwner);
    }

    public static void AcceptOwnership()
    {
        UInt160 pendingOwner = GetPendingOwner();
        ExecutionEngine.Assert(pendingOwner.IsValidAndNotZero, "no pending owner");
        ExecutionEngine.Assert(Runtime.CheckWitness(pendingOwner), "forbidden");
        ExecutionEngine.Assert(pendingOwner != GetSecurityCouncil(), "owner cannot equal security council");

        UInt160 oldOwner = GetOwner();
        Storage.Put(KeyOwner, (byte[])pendingOwner);
        Storage.Delete(KeyPendingOwner);

        OnOwnershipTransferred(oldOwner, pendingOwner);
    }

    [Safe]
    public static UInt160 GetVerifier()
    {
        ByteString? verifier = Storage.Get(KeyVerifier);
        return verifier is null ? UInt160.Zero : (UInt160)(byte[])verifier;
    }

    [Safe]
    public static UInt160 GetRelayer()
    {
        ByteString? relayer = Storage.Get(KeyRelayer);
        return relayer is null ? UInt160.Zero : (UInt160)(byte[])relayer;
    }

    [Safe]
    public static UInt160 GetSecurityCouncil()
    {
        ByteString? council = Storage.Get(KeySecurityCouncil);
        return council is null ? UInt160.Zero : (UInt160)(byte[])council;
    }



    [Safe]
    public static UInt160 GetPendingSecurityCouncil()
    {
        ByteString? pending = Storage.Get(KeyPendingSecurityCouncil);
        return pending is null ? UInt160.Zero : (UInt160)(byte[])pending;
    }

    [Safe]
    public static BigInteger GetPendingSecurityCouncilReadyAt()
    {
        ByteString? readyAt = Storage.Get(KeyPendingSecurityCouncilReadyAt);
        return readyAt is null ? 0 : (BigInteger)readyAt;
    }

    [Safe]
    public static UInt160 GetPendingVerifier()
    {
        ByteString? pending = Storage.Get(KeyPendingVerifier);
        return pending is null ? UInt160.Zero : (UInt160)(byte[])pending;
    }

    [Safe]
    public static BigInteger GetPendingVerifierReadyAt()
    {
        ByteString? readyAt = Storage.Get(KeyPendingVerifierReadyAt);
        return readyAt is null ? 0 : (BigInteger)readyAt;
    }

    [Safe]
    public static UInt160 GetPendingRelayer()
    {
        ByteString? pending = Storage.Get(KeyPendingRelayer);
        return pending is null ? UInt160.Zero : (UInt160)(byte[])pending;
    }

    [Safe]
    public static BigInteger GetPendingRelayerReadyAt()
    {
        ByteString? readyAt = Storage.Get(KeyPendingRelayerReadyAt);
        return readyAt is null ? 0 : (BigInteger)readyAt;
    }

    [Safe]
    public static BigInteger GetLeafIndex()
    {
        ByteString? index = Storage.Get(KeyLeafIndex);
        return index is null ? 0 : (BigInteger)index;
    }

    [Safe]
    public static byte[] GetCurrentRoot()
    {
        ByteString? root = Storage.Get(KeyCurrentRoot);
        return root is null ? new byte[0] : (byte[])root;
    }

    [Safe]
    public static BigInteger GetLastRootLeafCount()
    {
        ByteString? count = Storage.Get(KeyLastRootLeafCount);
        return count is null ? 0 : (BigInteger)count;
    }

    [Safe]
    public static bool IsKnownRoot(byte[] root)
    {
        if (root is null || root.Length != PrivacyGuards.MerkleRootLength)
            return false;

        return RootMap().Get(root) is not null;
    }

    [Safe]
    public static bool IsNullifierUsed(byte[] nullifierHash)
    {
        if (nullifierHash is null || nullifierHash.Length != PrivacyGuards.NullifierLength)
            return false;

        return NullifierMap().Get(nullifierHash) is not null;
    }

    [Safe]
    public static BigInteger GetAssetEscrowBalance(UInt160 asset)
    {
        return GetAssetBalance(asset);
    }

    [Safe]
    public static bool IsAssetAllowed(UInt160 asset)
    {
        if (!asset.IsValidAndNotZero)
            return false;

        return AllowedAssetMap().Get((byte[])asset) is not null;
    }

    [Safe]
    public static byte[] GetLeaf(BigInteger index)
    {
        ByteString? leaf = LeafMap().Get(index.ToByteArray());
        return leaf is null ? new byte[0] : (byte[])leaf;
    }

    [Safe]
    public static BigInteger GetCommitmentIndex(byte[] commitment)
    {
        ByteString? idx = CommitmentIndexMap().Get(commitment);
        return idx is null ? -1 : (BigInteger)idx;
    }

    [Safe]
    public static BigInteger GetRootLeafCount(byte[] root)
    {
        if (root is null || root.Length != PrivacyGuards.MerkleRootLength)
            return -1;

        ByteString? count = RootLeafCountMap().Get(root);
        return count is null ? -1 : (BigInteger)count;
    }

    public static void SetVerifier(UInt160 verifier)
    {
        ExecutionEngine.Assert(verifier.IsValidAndNotZero, "invalid verifier address");
        AssertOwnerWitness();
        UInt160 current = GetVerifier();
        ExecutionEngine.Assert(current.IsZero || current == verifier, "verifier already configured; use schedule");
        Storage.Put(KeyVerifier, (byte[])verifier);
    }

    public static void ScheduleVerifierUpdate(UInt160 verifier)
    {
        ExecutionEngine.Assert(verifier.IsValidAndNotZero, "invalid verifier address");
        AssertOwnerWitness();
        AssertSecurityCouncilWitness();

        UInt160 current = GetVerifier();
        ExecutionEngine.Assert(current.IsValidAndNotZero, "verifier not configured");
        ExecutionEngine.Assert(current != verifier, "verifier unchanged");

        BigInteger readyAt = (BigInteger)Runtime.Time + PrivacyGuards.ConfigUpdateDelaySeconds;
        Storage.Put(KeyPendingVerifier, (byte[])verifier);
        Storage.Put(KeyPendingVerifierReadyAt, readyAt);
    }

    public static void ApplyVerifierUpdate()
    {
        AssertOwnerWitness();
        AssertSecurityCouncilWitness();

        UInt160 pending = GetPendingVerifier();
        ExecutionEngine.Assert(pending.IsValidAndNotZero, "no pending verifier update");

        BigInteger readyAt = GetPendingVerifierReadyAt();
        ExecutionEngine.Assert((BigInteger)Runtime.Time >= readyAt, "verifier update timelocked");

        Storage.Put(KeyVerifier, (byte[])pending);
        Storage.Delete(KeyPendingVerifier);
        Storage.Delete(KeyPendingVerifierReadyAt);
    }

    public static void CancelVerifierUpdate()
    {
        AssertOwnerWitness();
        AssertSecurityCouncilWitness();
        Storage.Delete(KeyPendingVerifier);
        Storage.Delete(KeyPendingVerifierReadyAt);
    }

    public static void SetRelayer(UInt160 relayer)
    {
        ExecutionEngine.Assert(relayer.IsValidAndNotZero, "invalid relayer address");
        AssertOwnerWitness();
        UInt160 current = GetRelayer();
        ExecutionEngine.Assert(current.IsZero || current == relayer, "relayer already configured; use schedule");
        Storage.Put(KeyRelayer, (byte[])relayer);
    }

    public static void ScheduleRelayerUpdate(UInt160 relayer)
    {
        ExecutionEngine.Assert(relayer.IsValidAndNotZero, "invalid relayer address");
        AssertOwnerWitness();
        AssertSecurityCouncilWitness();

        UInt160 current = GetRelayer();
        ExecutionEngine.Assert(current.IsValidAndNotZero, "relayer not configured");
        ExecutionEngine.Assert(current != relayer, "relayer unchanged");

        BigInteger readyAt = (BigInteger)Runtime.Time + PrivacyGuards.ConfigUpdateDelaySeconds;
        Storage.Put(KeyPendingRelayer, (byte[])relayer);
        Storage.Put(KeyPendingRelayerReadyAt, readyAt);
    }

    public static void ApplyRelayerUpdate()
    {
        AssertOwnerWitness();
        AssertSecurityCouncilWitness();

        UInt160 pending = GetPendingRelayer();
        ExecutionEngine.Assert(pending.IsValidAndNotZero, "no pending relayer update");

        BigInteger readyAt = GetPendingRelayerReadyAt();
        ExecutionEngine.Assert((BigInteger)Runtime.Time >= readyAt, "relayer update timelocked");

        Storage.Put(KeyRelayer, (byte[])pending);
        Storage.Delete(KeyPendingRelayer);
        Storage.Delete(KeyPendingRelayerReadyAt);
    }

    public static void CancelRelayerUpdate()
    {
        AssertOwnerWitness();
        AssertSecurityCouncilWitness();
        Storage.Delete(KeyPendingRelayer);
        Storage.Delete(KeyPendingRelayerReadyAt);
    }

    public static void SetSecurityCouncil(UInt160 council)
    {
        ExecutionEngine.Assert(council.IsValidAndNotZero, "invalid security council address");
        AssertOwnerWitness();
        ExecutionEngine.Assert(council != GetOwner(), "security council cannot equal owner");
        UInt160 current = GetSecurityCouncil();
        ExecutionEngine.Assert(current.IsZero, "security council already set; use schedule");
        Storage.Put(KeySecurityCouncil, (byte[])council);
    }

    public static void ScheduleSecurityCouncilUpdate(UInt160 council)
    {
        ExecutionEngine.Assert(council.IsValidAndNotZero, "invalid security council address");
        AssertOwnerWitness();
        ExecutionEngine.Assert(council != GetOwner(), "security council cannot equal owner");

        UInt160 current = GetSecurityCouncil();
        ExecutionEngine.Assert(current.IsValidAndNotZero, "security council not configured");
        ExecutionEngine.Assert(current != council, "security council unchanged");
        AssertSecurityCouncilWitness();

        BigInteger readyAt = (BigInteger)Runtime.Time + PrivacyGuards.SecurityCouncilUpdateDelaySeconds;
        Storage.Put(KeyPendingSecurityCouncil, (byte[])council);
        Storage.Put(KeyPendingSecurityCouncilReadyAt, readyAt);
    }

    public static void ApplySecurityCouncilUpdate()
    {
        AssertOwnerWitness();
        AssertSecurityCouncilWitness();

        UInt160 pending = GetPendingSecurityCouncil();
        ExecutionEngine.Assert(pending.IsValidAndNotZero, "no pending security council update");
        ExecutionEngine.Assert(pending != GetOwner(), "security council cannot equal owner");

        BigInteger readyAt = GetPendingSecurityCouncilReadyAt();
        ExecutionEngine.Assert((BigInteger)Runtime.Time >= readyAt, "security council update timelocked");

        UInt160 oldCouncil = GetSecurityCouncil();
        Storage.Put(KeySecurityCouncil, (byte[])pending);
        Storage.Delete(KeyPendingSecurityCouncil);
        Storage.Delete(KeyPendingSecurityCouncilReadyAt);

        OnSecurityCouncilUpdated(oldCouncil, pending);
    }

    public static void CancelSecurityCouncilUpdate()
    {
        AssertOwnerWitness();
        AssertSecurityCouncilWitness();
        Storage.Delete(KeyPendingSecurityCouncil);
        Storage.Delete(KeyPendingSecurityCouncilReadyAt);
    }

    public static void SetAssetAllowed(UInt160 asset, bool allowed)
    {
        ExecutionEngine.Assert(asset.IsValidAndNotZero, "invalid asset address");
        AssertOwnerWitness();

        byte[] key = (byte[])asset;
        StorageMap map = AllowedAssetMap();
        if (allowed)
            map.Put(key, true);
        else
            map.Delete(key);
    }



    public static void UpdateMerkleRoot(byte[] proof, byte[] publicInputs, byte[] newRoot)
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
            oldRoot = (byte[])new byte[] { 0x50, 0x0d, 0x7e, 0xda, 0xc2, 0x49, 0x35, 0xfb, 0x57, 0x38, 0x44, 0x1c, 0x8f, 0x37, 0x78, 0xbc, 0xb7, 0x14, 0x49, 0xc5, 0x52, 0xc7, 0x56, 0x38, 0x3d, 0xc9, 0x86, 0xdc, 0x49, 0x9d, 0x63, 0x22 };
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
    }

    [NoReentrant]
    public static void Withdraw(
        UInt160 asset,
        byte[] proof,
        byte[] publicInputs,
        byte[] merkleRoot,
        byte[] nullifierHash,
        byte[] newCommitment,
        UInt160 recipient,
        UInt160 relayer,
        BigInteger amountWithdraw,
        BigInteger fee)
    {
        ExecutionEngine.Assert(!IsPaused(), "contract is paused");

        int rootLength = merkleRoot is null ? 0 : merkleRoot.Length;
        int nullifierLength = nullifierHash is null ? 0 : nullifierHash.Length;
        int proofLength = proof is null ? 0 : proof.Length;
        int newCommitmentLength = newCommitment is null ? 0 : newCommitment.Length;
        int publicInputsLength = publicInputs is null ? 0 : publicInputs.Length;

        ExecutionEngine.Assert(
            PrivacyGuards.IsValidWithdrawRequest(
                asset.IsValidAndNotZero,
                recipient.IsValidAndNotZero,
                relayer.IsValidAndNotZero,
                amountWithdraw,
                fee,
                rootLength,
                nullifierLength,
                newCommitmentLength,
                proofLength,
                publicInputsLength),
            "invalid withdraw arguments");
        ExecutionEngine.Assert(
            proof is not null
            && publicInputs is not null
            && merkleRoot is not null
            && nullifierHash is not null
           ,
            "proof/public inputs cannot be null");

        if (fee > 0)
        {
            UInt160 authorizedRelayer = GetRelayer();
            ExecutionEngine.Assert(authorizedRelayer.IsValidAndNotZero, "relayer not configured");
            ExecutionEngine.Assert(relayer == authorizedRelayer, "relayer mismatch");
            ExecutionEngine.Assert(Runtime.CheckWitness(authorizedRelayer), "forbidden relayer");
        }
        else
        {
            ExecutionEngine.Assert(relayer == recipient, "self-claim requires relayer=recipient");
            ExecutionEngine.Assert(Runtime.CheckWitness(recipient), "forbidden recipient");
        }

        ExecutionEngine.Assert(IsKnownRoot(merkleRoot!), "unknown merkle root");
        ExecutionEngine.Assert(!IsNullifierUsed(nullifierHash!), "nullifier already used");
        ExecutionEngine.Assert(
            VerifyProof(asset, proof!, publicInputs!, merkleRoot!, nullifierHash!, newCommitment!, recipient, relayer, amountWithdraw, fee),
            "zk proof invalid");

        BigInteger payout = PrivacyGuards.CalculateRecipientPayout(amountWithdraw, fee);
        NullifierMap().Put(nullifierHash!, true);
        
        // UTXO: Append the new commitment to the Merkle tree like a deposit
        BigInteger index = NextLeafIndex();
        ExecutionEngine.Assert(CommitmentIndexMap().Get(newCommitment!) is null, "commitment already deposited");
        LeafMap().Put(index.ToByteArray(), newCommitment!);
        CommitmentIndexMap().Put(newCommitment!, index);
        
        TransferOut(asset, recipient, payout);
        if (fee > 0)
            TransferOut(asset, relayer, fee);

        OnPrivacyWithdraw(asset, recipient, amountWithdraw, nullifierHash!);
        // Emit deposit event for the change so the maintainer can index it
        OnPrivacyDeposit(asset, UInt160.Zero, 0, newCommitment!, index);
    }

    [DisplayName("onNEP17Payment")]
    [NoReentrant]
    public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
    {
        ExecutionEngine.Assert(!IsPaused(), "contract is paused");

        UInt160 asset = Runtime.CallingScriptHash;
        ExecutionEngine.Assert(IsAssetAllowed(asset), "asset not allowed");
        ExecutionEngine.Assert(from.IsValidAndNotZero, "invalid depositor");

        ExecutionEngine.Assert(data is not null, "invalid deposit data");
        object[] arr = (object[])data!;
        ExecutionEngine.Assert(arr.Length == 2, "invalid deposit data length");
        UInt160 stealthAddress = (UInt160)arr[0];
        byte[] leaf = (byte[])arr[1];

        int leafLength = leaf is null ? 0 : leaf.Length;
        ExecutionEngine.Assert(
            PrivacyGuards.IsValidDepositRequest(
                asset.IsValidAndNotZero,
                stealthAddress.IsValidAndNotZero,
                amount,
                leafLength),
            "invalid deposit arguments");
        ExecutionEngine.Assert(leaf is not null, "leaf is required");
        BigInteger current = GetAssetBalance(asset);
        SetAssetBalance(asset, current + amount);

        BigInteger index = NextLeafIndex();
        ExecutionEngine.Assert(CommitmentIndexMap().Get(leaf!) is null, "commitment already deposited");
        LeafMap().Put(index.ToByteArray(), leaf!);
        CommitmentIndexMap().Put(leaf!, index);
        OnPrivacyDeposit(asset, stealthAddress, amount, leaf!, index);
    }

    private static void AssertOwnerWitness()
    {
        UInt160 owner = GetOwner();
        ExecutionEngine.Assert(owner.IsValidAndNotZero, "owner not set");
        ExecutionEngine.Assert(Runtime.CheckWitness(owner), "forbidden");
    }

    private static void AssertSecurityCouncilWitness()
    {
        UInt160 council = GetSecurityCouncil();
        ExecutionEngine.Assert(council.IsValidAndNotZero, "security council not set");
        ExecutionEngine.Assert(Runtime.CheckWitness(council), "forbidden council");
    }

    private static BigInteger NextLeafIndex()
    {
        BigInteger current = GetLeafIndex();
        ExecutionEngine.Assert(current < PrivacyGuards.MaxLeafIndex, "merkle tree is full");
        Storage.Put(KeyLeafIndex, current + 1);
        return current;
    }

    private static void PruneOldRootHistory(BigInteger latestIndex)
    {
        if (latestIndex < PrivacyGuards.MaxRootHistoryEntries)
            return;

        BigInteger pruneIndex = latestIndex - PrivacyGuards.MaxRootHistoryEntries;
        byte[] key = pruneIndex.ToByteArray();
        StorageMap history = RootHistoryMap();
        ByteString? prunedRoot = history.Get(key);
        if (prunedRoot is not null)
        {
            byte[] root = (byte[])prunedRoot;
            RootMap().Delete(root);
            RootLeafCountMap().Delete(root);
        }
        history.Delete(key);
    }

    private static bool VerifyProof(
        UInt160 asset,
        byte[] proof,
        byte[] publicInputs,
        byte[] merkleRoot,
        byte[] nullifierHash,
        byte[] newCommitment,
        UInt160 recipient,
        UInt160 relayer,
        BigInteger amountWithdraw,
        BigInteger fee)
    {
        UInt160 verifier = GetVerifier();
        if (verifier.IsZero)
            return false;

        object result = Contract.Call(
            verifier,
            "verify",
            CallFlags.ReadOnly,
            asset,
            proof,
            publicInputs,
            merkleRoot,
            nullifierHash,
            newCommitment,
            recipient,
            relayer,
            amountWithdraw,
            fee);

        return result is bool ok && ok;
    }

    private static void TransferOut(UInt160 asset, UInt160 to, BigInteger amount)
    {
        if (amount == 0)
            return;

        BigInteger current = GetAssetBalance(asset);
        ExecutionEngine.Assert(current >= amount, "insufficient vault balance");
        SetAssetBalance(asset, current - amount);

        object result = Contract.Call(
            asset,
            "transfer",
            CallFlags.All,
            Runtime.ExecutingScriptHash,
            to,
            amount,
            null);

        ExecutionEngine.Assert(result is bool ok && ok, "asset transfer out failed");
    }

    private static BigInteger GetAssetBalance(UInt160 asset)
    {
        ByteString? stored = AssetBalanceMap().Get((byte[])asset);
        return stored is null ? 0 : (BigInteger)stored;
    }

    private static void SetAssetBalance(UInt160 asset, BigInteger amount)
    {
        byte[] key = (byte[])asset;
        StorageMap map = AssetBalanceMap();
        if (amount == 0)
            map.Delete(key);
        else
            map.Put(key, amount);
    }

    private static StorageMap RootMap() => new(Storage.CurrentContext, PrefixRoots);
    private static StorageMap RootHistoryMap() => new(Storage.CurrentContext, PrefixRootHistory);
    private static StorageMap NullifierMap() => new(Storage.CurrentContext, PrefixNullifiers);
    private static StorageMap LeafMap() => new(Storage.CurrentContext, PrefixLeaves);
    private static StorageMap CommitmentIndexMap() => new(Storage.CurrentContext, PrefixCommitmentIndices);
    private static StorageMap CommitmentSpentMap() => new(Storage.CurrentContext, PrefixSpentCommitments);
    private static StorageMap AssetBalanceMap() => new(Storage.CurrentContext, PrefixAssetBalances);
    private static StorageMap AllowedAssetMap() => new(Storage.CurrentContext, PrefixAllowedAssets);
    private static StorageMap RootLeafCountMap() => new(Storage.CurrentContext, PrefixRootLeafCounts);
}
