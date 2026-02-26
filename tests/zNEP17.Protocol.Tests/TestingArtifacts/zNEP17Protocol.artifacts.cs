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

    public static Neo.SmartContract.Manifest.ContractManifest Manifest => Neo.SmartContract.Manifest.ContractManifest.Parse(@"{""name"":""zNEP17Protocol"",""groups"":[],""features"":{},""supportedstandards"":[""zNEP-17""],""abi"":{""methods"":[{""name"":""_deploy"",""parameters"":[{""name"":""data"",""type"":""Any""},{""name"":""update"",""type"":""Boolean""}],""returntype"":""Void"",""offset"":0,""safe"":false},{""name"":""isPaused"",""parameters"":[],""returntype"":""Boolean"",""offset"":61,""safe"":true},{""name"":""setPaused"",""parameters"":[{""name"":""paused"",""type"":""Boolean""}],""returntype"":""Void"",""offset"":110,""safe"":false},{""name"":""getOwner"",""parameters"":[],""returntype"":""Hash160"",""offset"":204,""safe"":true},{""name"":""getPendingOwner"",""parameters"":[],""returntype"":""Hash160"",""offset"":354,""safe"":true},{""name"":""transferOwnership"",""parameters"":[{""name"":""newOwner"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":414,""safe"":false},{""name"":""acceptOwnership"",""parameters"":[],""returntype"":""Void"",""offset"":465,""safe"":false},{""name"":""getVerifier"",""parameters"":[],""returntype"":""Hash160"",""offset"":681,""safe"":true},{""name"":""getRelayer"",""parameters"":[],""returntype"":""Hash160"",""offset"":741,""safe"":true},{""name"":""getSecurityCouncil"",""parameters"":[],""returntype"":""Hash160"",""offset"":615,""safe"":true},{""name"":""getTreeMaintainer"",""parameters"":[],""returntype"":""Hash160"",""offset"":801,""safe"":true},{""name"":""getPendingSecurityCouncil"",""parameters"":[],""returntype"":""Hash160"",""offset"":862,""safe"":true},{""name"":""getPendingSecurityCouncilReadyAt"",""parameters"":[],""returntype"":""Integer"",""offset"":923,""safe"":true},{""name"":""getPendingVerifier"",""parameters"":[],""returntype"":""Hash160"",""offset"":969,""safe"":true},{""name"":""getPendingVerifierReadyAt"",""parameters"":[],""returntype"":""Integer"",""offset"":1030,""safe"":true},{""name"":""getPendingRelayer"",""parameters"":[],""returntype"":""Hash160"",""offset"":1065,""safe"":true},{""name"":""getPendingRelayerReadyAt"",""parameters"":[],""returntype"":""Integer"",""offset"":1126,""safe"":true},{""name"":""getLeafIndex"",""parameters"":[],""returntype"":""Integer"",""offset"":1161,""safe"":true},{""name"":""getCurrentRoot"",""parameters"":[],""returntype"":""ByteArray"",""offset"":1195,""safe"":true},{""name"":""getLastRootLeafCount"",""parameters"":[],""returntype"":""Integer"",""offset"":1223,""safe"":true},{""name"":""isKnownRoot"",""parameters"":[{""name"":""root"",""type"":""ByteArray""}],""returntype"":""Boolean"",""offset"":1258,""safe"":true},{""name"":""isNullifierUsed"",""parameters"":[{""name"":""nullifierHash"",""type"":""ByteArray""}],""returntype"":""Boolean"",""offset"":1345,""safe"":true},{""name"":""getAssetEscrowBalance"",""parameters"":[{""name"":""asset"",""type"":""Hash160""}],""returntype"":""Integer"",""offset"":1405,""safe"":true},{""name"":""isAssetAllowed"",""parameters"":[{""name"":""asset"",""type"":""Hash160""}],""returntype"":""Boolean"",""offset"":1473,""safe"":true},{""name"":""getLeaf"",""parameters"":[{""name"":""index"",""type"":""Integer""}],""returntype"":""ByteArray"",""offset"":1527,""safe"":true},{""name"":""getCommitmentIndex"",""parameters"":[{""name"":""commitment"",""type"":""ByteArray""}],""returntype"":""Integer"",""offset"":1579,""safe"":true},{""name"":""getRootLeafCount"",""parameters"":[{""name"":""root"",""type"":""ByteArray""}],""returntype"":""Integer"",""offset"":1636,""safe"":true},{""name"":""setVerifier"",""parameters"":[{""name"":""verifier"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":1713,""safe"":false},{""name"":""scheduleVerifierUpdate"",""parameters"":[{""name"":""verifier"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":1829,""safe"":false},{""name"":""applyVerifierUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2050,""safe"":false},{""name"":""cancelVerifierUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2171,""safe"":false},{""name"":""setRelayer"",""parameters"":[{""name"":""relayer"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":2196,""safe"":false},{""name"":""scheduleRelayerUpdate"",""parameters"":[{""name"":""relayer"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":2310,""safe"":false},{""name"":""applyRelayerUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2452,""safe"":false},{""name"":""cancelRelayerUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2574,""safe"":false},{""name"":""setSecurityCouncil"",""parameters"":[{""name"":""council"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":2599,""safe"":false},{""name"":""scheduleSecurityCouncilUpdate"",""parameters"":[{""name"":""council"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":2763,""safe"":false},{""name"":""applySecurityCouncilUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2979,""safe"":false},{""name"":""cancelSecurityCouncilUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":3205,""safe"":false},{""name"":""setAssetAllowed"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""allowed"",""type"":""Boolean""}],""returntype"":""Void"",""offset"":3230,""safe"":false},{""name"":""setTreeMaintainer"",""parameters"":[{""name"":""maintainer"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":3333,""safe"":false},{""name"":""updateMerkleRoot"",""parameters"":[{""name"":""newRoot"",""type"":""ByteArray""},{""name"":""expectedLeafCount"",""type"":""Integer""}],""returntype"":""Void"",""offset"":3394,""safe"":false},{""name"":""withdraw"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""proof"",""type"":""ByteArray""},{""name"":""publicInputs"",""type"":""ByteArray""},{""name"":""merkleRoot"",""type"":""ByteArray""},{""name"":""nullifierHash"",""type"":""ByteArray""},{""name"":""newCommitment"",""type"":""ByteArray""},{""name"":""recipient"",""type"":""Hash160""},{""name"":""relayer"",""type"":""Hash160""},{""name"":""amountWithdraw"",""type"":""Integer""},{""name"":""fee"",""type"":""Integer""}],""returntype"":""Void"",""offset"":3989,""safe"":false},{""name"":""onNEP17Payment"",""parameters"":[{""name"":""from"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""data"",""type"":""Any""}],""returntype"":""Void"",""offset"":5381,""safe"":false},{""name"":""_initialize"",""parameters"":[],""returntype"":""Void"",""offset"":5883,""safe"":false}],""events"":[{""name"":""PrivacyDeposit"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""stealthAddress"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""leaf"",""type"":""ByteArray""},{""name"":""index"",""type"":""Integer""}]},{""name"":""PrivacyWithdraw"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""recipient"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""nullifier"",""type"":""ByteArray""}]},{""name"":""OwnershipTransferred"",""parameters"":[{""name"":""previousOwner"",""type"":""Hash160""},{""name"":""newOwner"",""type"":""Hash160""}]},{""name"":""Paused"",""parameters"":[{""name"":""isPaused"",""type"":""Boolean""}]},{""name"":""MerkleRootUpdated"",""parameters"":[{""name"":""newRoot"",""type"":""ByteArray""},{""name"":""leafCount"",""type"":""Integer""}]},{""name"":""SecurityCouncilUpdated"",""parameters"":[{""name"":""previousCouncil"",""type"":""Hash160""},{""name"":""newCouncil"",""type"":""Hash160""}]}]},""permissions"":[{""contract"":""*"",""methods"":[""transfer"",""verify""]}],""trusts"":[],""extra"":{""Author"":""Neo Community"",""Description"":""zNEP-17 privacy vault for Neo N3 with zk-SNARK based private transfers."",""Version"":""0.1.0"",""nef"":{""optimization"":""Basic""}}}");

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
    public abstract void Withdraw(UInt160? asset, byte[]? proof, byte[]? publicInputs, byte[]? merkleRoot, byte[]? nullifierHash, byte[]? newCommitment, UInt160? recipient, UInt160? relayer, BigInteger? amountWithdraw, BigInteger? fee);

    #endregion
}
