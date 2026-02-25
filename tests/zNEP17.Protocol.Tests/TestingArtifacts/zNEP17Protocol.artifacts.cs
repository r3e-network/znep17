using Neo.Cryptography.ECC;
using Neo.Extensions;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Numerics;

#pragma warning disable CS0067

namespace Neo.SmartContract.Testing;

public abstract class zNEP17Protocol(Neo.SmartContract.Testing.SmartContractInitialize initialize) : Neo.SmartContract.Testing.SmartContract(initialize), IContractInfo
{
    #region Compiled data

    public static Neo.SmartContract.Manifest.ContractManifest Manifest => Neo.SmartContract.Manifest.ContractManifest.Parse(@"{""name"":""zNEP17Protocol"",""groups"":[],""features"":{},""supportedstandards"":[""zNEP-17""],""abi"":{""methods"":[{""name"":""_deploy"",""parameters"":[{""name"":""data"",""type"":""Any""},{""name"":""update"",""type"":""Boolean""}],""returntype"":""Void"",""offset"":0,""safe"":false},{""name"":""isPaused"",""parameters"":[],""returntype"":""Boolean"",""offset"":61,""safe"":true},{""name"":""setPaused"",""parameters"":[{""name"":""paused"",""type"":""Boolean""}],""returntype"":""Void"",""offset"":110,""safe"":false},{""name"":""getOwner"",""parameters"":[],""returntype"":""Hash160"",""offset"":204,""safe"":true},{""name"":""getPendingOwner"",""parameters"":[],""returntype"":""Hash160"",""offset"":354,""safe"":true},{""name"":""transferOwnership"",""parameters"":[{""name"":""newOwner"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":414,""safe"":false},{""name"":""acceptOwnership"",""parameters"":[],""returntype"":""Void"",""offset"":465,""safe"":false},{""name"":""getVerifier"",""parameters"":[],""returntype"":""Hash160"",""offset"":681,""safe"":true},{""name"":""getRelayer"",""parameters"":[],""returntype"":""Hash160"",""offset"":741,""safe"":true},{""name"":""getSecurityCouncil"",""parameters"":[],""returntype"":""Hash160"",""offset"":615,""safe"":true},{""name"":""getTreeMaintainer"",""parameters"":[],""returntype"":""Hash160"",""offset"":801,""safe"":true},{""name"":""getPendingSecurityCouncil"",""parameters"":[],""returntype"":""Hash160"",""offset"":862,""safe"":true},{""name"":""getPendingSecurityCouncilReadyAt"",""parameters"":[],""returntype"":""Integer"",""offset"":923,""safe"":true},{""name"":""getPendingVerifier"",""parameters"":[],""returntype"":""Hash160"",""offset"":969,""safe"":true},{""name"":""getPendingVerifierReadyAt"",""parameters"":[],""returntype"":""Integer"",""offset"":1030,""safe"":true},{""name"":""getPendingRelayer"",""parameters"":[],""returntype"":""Hash160"",""offset"":1065,""safe"":true},{""name"":""getPendingRelayerReadyAt"",""parameters"":[],""returntype"":""Integer"",""offset"":1126,""safe"":true},{""name"":""getLeafIndex"",""parameters"":[],""returntype"":""Integer"",""offset"":1161,""safe"":true},{""name"":""getCurrentRoot"",""parameters"":[],""returntype"":""ByteArray"",""offset"":1195,""safe"":true},{""name"":""getLastRootLeafCount"",""parameters"":[],""returntype"":""Integer"",""offset"":1223,""safe"":true},{""name"":""isKnownRoot"",""parameters"":[{""name"":""root"",""type"":""ByteArray""}],""returntype"":""Boolean"",""offset"":1258,""safe"":true},{""name"":""isNullifierUsed"",""parameters"":[{""name"":""nullifierHash"",""type"":""ByteArray""}],""returntype"":""Boolean"",""offset"":1345,""safe"":true},{""name"":""getCommitmentIndex"",""parameters"":[{""name"":""commitment"",""type"":""ByteArray""}],""returntype"":""Integer"",""offset"":1405,""safe"":true},{""name"":""isCommitmentSpent"",""parameters"":[{""name"":""commitment"",""type"":""ByteArray""}],""returntype"":""Boolean"",""offset"":1482,""safe"":true},{""name"":""getAssetEscrowBalance"",""parameters"":[{""name"":""asset"",""type"":""Hash160""}],""returntype"":""Integer"",""offset"":1542,""safe"":true},{""name"":""isAssetAllowed"",""parameters"":[{""name"":""asset"",""type"":""Hash160""}],""returntype"":""Boolean"",""offset"":1610,""safe"":true},{""name"":""getLeaf"",""parameters"":[{""name"":""index"",""type"":""Integer""}],""returntype"":""ByteArray"",""offset"":1664,""safe"":true},{""name"":""getRootLeafCount"",""parameters"":[{""name"":""root"",""type"":""ByteArray""}],""returntype"":""Integer"",""offset"":1716,""safe"":true},{""name"":""setVerifier"",""parameters"":[{""name"":""verifier"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":1793,""safe"":false},{""name"":""scheduleVerifierUpdate"",""parameters"":[{""name"":""verifier"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":1909,""safe"":false},{""name"":""applyVerifierUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2130,""safe"":false},{""name"":""cancelVerifierUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2251,""safe"":false},{""name"":""setRelayer"",""parameters"":[{""name"":""relayer"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":2276,""safe"":false},{""name"":""scheduleRelayerUpdate"",""parameters"":[{""name"":""relayer"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":2390,""safe"":false},{""name"":""applyRelayerUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2532,""safe"":false},{""name"":""cancelRelayerUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2654,""safe"":false},{""name"":""setSecurityCouncil"",""parameters"":[{""name"":""council"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":2679,""safe"":false},{""name"":""scheduleSecurityCouncilUpdate"",""parameters"":[{""name"":""council"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":2843,""safe"":false},{""name"":""applySecurityCouncilUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":3059,""safe"":false},{""name"":""cancelSecurityCouncilUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":3285,""safe"":false},{""name"":""setAssetAllowed"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""allowed"",""type"":""Boolean""}],""returntype"":""Void"",""offset"":3310,""safe"":false},{""name"":""setTreeMaintainer"",""parameters"":[{""name"":""maintainer"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":3413,""safe"":false},{""name"":""updateMerkleRoot"",""parameters"":[{""name"":""newRoot"",""type"":""ByteArray""},{""name"":""expectedLeafCount"",""type"":""Integer""}],""returntype"":""Void"",""offset"":3474,""safe"":false},{""name"":""withdraw"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""proof"",""type"":""ByteArray""},{""name"":""publicInputs"",""type"":""ByteArray""},{""name"":""merkleRoot"",""type"":""ByteArray""},{""name"":""nullifierHash"",""type"":""ByteArray""},{""name"":""commitment"",""type"":""ByteArray""},{""name"":""recipient"",""type"":""Hash160""},{""name"":""relayer"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""fee"",""type"":""Integer""}],""returntype"":""Void"",""offset"":4069,""safe"":false},{""name"":""onNEP17Payment"",""parameters"":[{""name"":""from"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""data"",""type"":""Any""}],""returntype"":""Void"",""offset"":5357,""safe"":false},{""name"":""_initialize"",""parameters"":[],""returntype"":""Void"",""offset"":5896,""safe"":false}],""events"":[{""name"":""PrivacyDeposit"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""stealthAddress"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""leaf"",""type"":""ByteArray""},{""name"":""index"",""type"":""Integer""}]},{""name"":""PrivacyWithdraw"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""recipient"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""nullifier"",""type"":""ByteArray""}]},{""name"":""OwnershipTransferred"",""parameters"":[{""name"":""previousOwner"",""type"":""Hash160""},{""name"":""newOwner"",""type"":""Hash160""}]},{""name"":""Paused"",""parameters"":[{""name"":""isPaused"",""type"":""Boolean""}]},{""name"":""MerkleRootUpdated"",""parameters"":[{""name"":""newRoot"",""type"":""ByteArray""},{""name"":""leafCount"",""type"":""Integer""}]},{""name"":""SecurityCouncilUpdated"",""parameters"":[{""name"":""previousCouncil"",""type"":""Hash160""},{""name"":""newCouncil"",""type"":""Hash160""}]}]},""permissions"":[{""contract"":""*"",""methods"":[""transfer"",""verify""]}],""trusts"":[],""extra"":{""Author"":""Neo Community"",""Description"":""zNEP-17 privacy vault for Neo N3 with zk-SNARK based private transfers."",""Version"":""0.1.0"",""nef"":{""optimization"":""Basic""}}}");

    /// <summary>
    /// Optimization: "Basic"
    /// </summary>
    public static Neo.SmartContract.NefFile Nef => Convert.FromBase64String(@"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").AsSerializable<Neo.SmartContract.NefFile>();

    #endregion

    #region Events

    public delegate void delMerkleRootUpdated(byte[]? newRoot, BigInteger? leafCount);

    [DisplayName("MerkleRootUpdated")]
    public event delMerkleRootUpdated? OnMerkleRootUpdated;

    public delegate void delOwnershipTransferred(UInt160? previousOwner, UInt160? newOwner);

    [DisplayName("OwnershipTransferred")]
    public event delOwnershipTransferred? OnOwnershipTransferred;

    public delegate void delPaused(bool? isPaused);

    [DisplayName("Paused")]
    public event delPaused? OnPaused;

    public delegate void delPrivacyDeposit(UInt160? asset, UInt160? stealthAddress, BigInteger? amount, byte[]? leaf, BigInteger? index);

    [DisplayName("PrivacyDeposit")]
    public event delPrivacyDeposit? OnPrivacyDeposit;

    public delegate void delPrivacyWithdraw(UInt160? asset, UInt160? recipient, BigInteger? amount, byte[]? nullifier);

    [DisplayName("PrivacyWithdraw")]
    public event delPrivacyWithdraw? OnPrivacyWithdraw;

    public delegate void delSecurityCouncilUpdated(UInt160? previousCouncil, UInt160? newCouncil);

    [DisplayName("SecurityCouncilUpdated")]
    public event delSecurityCouncilUpdated? OnSecurityCouncilUpdated;

    #endregion

    #region Properties

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract byte[]? CurrentRoot { [DisplayName("getCurrentRoot")] get; }

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract BigInteger? LastRootLeafCount { [DisplayName("getLastRootLeafCount")] get; }

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract BigInteger? LeafIndex { [DisplayName("getLeafIndex")] get; }

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract UInt160? Owner { [DisplayName("getOwner")] get; }

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract UInt160? PendingOwner { [DisplayName("getPendingOwner")] get; }

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract UInt160? PendingRelayer { [DisplayName("getPendingRelayer")] get; }

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract BigInteger? PendingRelayerReadyAt { [DisplayName("getPendingRelayerReadyAt")] get; }

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract UInt160? PendingSecurityCouncil { [DisplayName("getPendingSecurityCouncil")] get; }

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract BigInteger? PendingSecurityCouncilReadyAt { [DisplayName("getPendingSecurityCouncilReadyAt")] get; }

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract UInt160? PendingVerifier { [DisplayName("getPendingVerifier")] get; }

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract BigInteger? PendingVerifierReadyAt { [DisplayName("getPendingVerifierReadyAt")] get; }

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract UInt160? Relayer { [DisplayName("getRelayer")] get; [DisplayName("setRelayer")] set; }

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract UInt160? SecurityCouncil { [DisplayName("getSecurityCouncil")] get; [DisplayName("setSecurityCouncil")] set; }

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract UInt160? TreeMaintainer { [DisplayName("getTreeMaintainer")] get; [DisplayName("setTreeMaintainer")] set; }

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract UInt160? Verifier { [DisplayName("getVerifier")] get; [DisplayName("setVerifier")] set; }

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract bool? IsPaused { [DisplayName("isPaused")] get; }

    #endregion

    #region Safe methods

    /// <summary>
    /// Safe method
    /// </summary>
    [DisplayName("getAssetEscrowBalance")]
    public abstract BigInteger? GetAssetEscrowBalance(UInt160? asset);

    /// <summary>
    /// Safe method
    /// </summary>
    [DisplayName("getCommitmentIndex")]
    public abstract BigInteger? GetCommitmentIndex(byte[]? commitment);

    /// <summary>
    /// Safe method
    /// </summary>
    [DisplayName("getLeaf")]
    public abstract byte[]? GetLeaf(BigInteger? index);

    /// <summary>
    /// Safe method
    /// </summary>
    [DisplayName("getRootLeafCount")]
    public abstract BigInteger? GetRootLeafCount(byte[]? root);

    /// <summary>
    /// Safe method
    /// </summary>
    [DisplayName("isAssetAllowed")]
    public abstract bool? IsAssetAllowed(UInt160? asset);

    /// <summary>
    /// Safe method
    /// </summary>
    [DisplayName("isCommitmentSpent")]
    public abstract bool? IsCommitmentSpent(byte[]? commitment);

    /// <summary>
    /// Safe method
    /// </summary>
    [DisplayName("isKnownRoot")]
    public abstract bool? IsKnownRoot(byte[]? root);

    /// <summary>
    /// Safe method
    /// </summary>
    [DisplayName("isNullifierUsed")]
    public abstract bool? IsNullifierUsed(byte[]? nullifierHash);

    #endregion

    #region Unsafe methods

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("acceptOwnership")]
    public abstract void AcceptOwnership();

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("applyRelayerUpdate")]
    public abstract void ApplyRelayerUpdate();

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("applySecurityCouncilUpdate")]
    public abstract void ApplySecurityCouncilUpdate();

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("applyVerifierUpdate")]
    public abstract void ApplyVerifierUpdate();

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("cancelRelayerUpdate")]
    public abstract void CancelRelayerUpdate();

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("cancelSecurityCouncilUpdate")]
    public abstract void CancelSecurityCouncilUpdate();

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("cancelVerifierUpdate")]
    public abstract void CancelVerifierUpdate();

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("onNEP17Payment")]
    public abstract void OnNEP17Payment(UInt160? from, BigInteger? amount, object? data = null);

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("scheduleRelayerUpdate")]
    public abstract void ScheduleRelayerUpdate(UInt160? relayer);

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("scheduleSecurityCouncilUpdate")]
    public abstract void ScheduleSecurityCouncilUpdate(UInt160? council);

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("scheduleVerifierUpdate")]
    public abstract void ScheduleVerifierUpdate(UInt160? verifier);

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("setAssetAllowed")]
    public abstract void SetAssetAllowed(UInt160? asset, bool? allowed);

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("setPaused")]
    public abstract void SetPaused(bool? paused);

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("transferOwnership")]
    public abstract void TransferOwnership(UInt160? newOwner);

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("updateMerkleRoot")]
    public abstract void UpdateMerkleRoot(byte[]? newRoot, BigInteger? expectedLeafCount);

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("withdraw")]
    public abstract void Withdraw(UInt160? asset, byte[]? proof, byte[]? publicInputs, byte[]? merkleRoot, byte[]? nullifierHash, byte[]? commitment, UInt160? recipient, UInt160? relayer, BigInteger? amount, BigInteger? fee);

    #endregion
}
