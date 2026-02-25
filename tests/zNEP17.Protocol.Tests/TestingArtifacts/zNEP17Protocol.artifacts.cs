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

    public static Neo.SmartContract.Manifest.ContractManifest Manifest => Neo.SmartContract.Manifest.ContractManifest.Parse(@"{""name"":""zNEP17Protocol"",""groups"":[],""features"":{},""supportedstandards"":[""zNEP-17""],""abi"":{""methods"":[{""name"":""_deploy"",""parameters"":[{""name"":""data"",""type"":""Any""},{""name"":""update"",""type"":""Boolean""}],""returntype"":""Void"",""offset"":0,""safe"":false},{""name"":""isPaused"",""parameters"":[],""returntype"":""Boolean"",""offset"":61,""safe"":true},{""name"":""setPaused"",""parameters"":[{""name"":""paused"",""type"":""Boolean""}],""returntype"":""Void"",""offset"":110,""safe"":false},{""name"":""getOwner"",""parameters"":[],""returntype"":""Hash160"",""offset"":208,""safe"":true},{""name"":""getPendingOwner"",""parameters"":[],""returntype"":""Hash160"",""offset"":358,""safe"":true},{""name"":""transferOwnership"",""parameters"":[{""name"":""newOwner"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":418,""safe"":false},{""name"":""acceptOwnership"",""parameters"":[],""returntype"":""Void"",""offset"":469,""safe"":false},{""name"":""getVerifier"",""parameters"":[],""returntype"":""Hash160"",""offset"":685,""safe"":true},{""name"":""getRelayer"",""parameters"":[],""returntype"":""Hash160"",""offset"":745,""safe"":true},{""name"":""getSecurityCouncil"",""parameters"":[],""returntype"":""Hash160"",""offset"":619,""safe"":true},{""name"":""getTreeMaintainer"",""parameters"":[],""returntype"":""Hash160"",""offset"":805,""safe"":true},{""name"":""getPendingSecurityCouncil"",""parameters"":[],""returntype"":""Hash160"",""offset"":866,""safe"":true},{""name"":""getPendingSecurityCouncilReadyAt"",""parameters"":[],""returntype"":""Integer"",""offset"":927,""safe"":true},{""name"":""getPendingVerifier"",""parameters"":[],""returntype"":""Hash160"",""offset"":973,""safe"":true},{""name"":""getPendingVerifierReadyAt"",""parameters"":[],""returntype"":""Integer"",""offset"":1034,""safe"":true},{""name"":""getPendingRelayer"",""parameters"":[],""returntype"":""Hash160"",""offset"":1069,""safe"":true},{""name"":""getPendingRelayerReadyAt"",""parameters"":[],""returntype"":""Integer"",""offset"":1130,""safe"":true},{""name"":""getLeafIndex"",""parameters"":[],""returntype"":""Integer"",""offset"":1165,""safe"":true},{""name"":""getCurrentRoot"",""parameters"":[],""returntype"":""ByteArray"",""offset"":1199,""safe"":true},{""name"":""getLastRootLeafCount"",""parameters"":[],""returntype"":""Integer"",""offset"":1227,""safe"":true},{""name"":""isKnownRoot"",""parameters"":[{""name"":""root"",""type"":""ByteArray""}],""returntype"":""Boolean"",""offset"":1262,""safe"":true},{""name"":""isNullifierUsed"",""parameters"":[{""name"":""nullifierHash"",""type"":""ByteArray""}],""returntype"":""Boolean"",""offset"":1349,""safe"":true},{""name"":""getAssetEscrowBalance"",""parameters"":[{""name"":""asset"",""type"":""Hash160""}],""returntype"":""Integer"",""offset"":1409,""safe"":true},{""name"":""isAssetAllowed"",""parameters"":[{""name"":""asset"",""type"":""Hash160""}],""returntype"":""Boolean"",""offset"":1477,""safe"":true},{""name"":""getLeaf"",""parameters"":[{""name"":""index"",""type"":""Integer""}],""returntype"":""ByteArray"",""offset"":1531,""safe"":true},{""name"":""getRootLeafCount"",""parameters"":[{""name"":""root"",""type"":""ByteArray""}],""returntype"":""Integer"",""offset"":1583,""safe"":true},{""name"":""setVerifier"",""parameters"":[{""name"":""verifier"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":1660,""safe"":false},{""name"":""scheduleVerifierUpdate"",""parameters"":[{""name"":""verifier"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":1776,""safe"":false},{""name"":""applyVerifierUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":1997,""safe"":false},{""name"":""cancelVerifierUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2118,""safe"":false},{""name"":""setRelayer"",""parameters"":[{""name"":""relayer"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":2143,""safe"":false},{""name"":""scheduleRelayerUpdate"",""parameters"":[{""name"":""relayer"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":2257,""safe"":false},{""name"":""applyRelayerUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2399,""safe"":false},{""name"":""cancelRelayerUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2521,""safe"":false},{""name"":""setSecurityCouncil"",""parameters"":[{""name"":""council"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":2546,""safe"":false},{""name"":""scheduleSecurityCouncilUpdate"",""parameters"":[{""name"":""council"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":2710,""safe"":false},{""name"":""applySecurityCouncilUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2926,""safe"":false},{""name"":""cancelSecurityCouncilUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":3152,""safe"":false},{""name"":""setAssetAllowed"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""allowed"",""type"":""Boolean""}],""returntype"":""Void"",""offset"":3177,""safe"":false},{""name"":""setTreeMaintainer"",""parameters"":[{""name"":""maintainer"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":3280,""safe"":false},{""name"":""updateMerkleRoot"",""parameters"":[{""name"":""newRoot"",""type"":""ByteArray""}],""returntype"":""Void"",""offset"":3341,""safe"":false},{""name"":""withdraw"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""proof"",""type"":""ByteArray""},{""name"":""publicInputs"",""type"":""ByteArray""},{""name"":""merkleRoot"",""type"":""ByteArray""},{""name"":""nullifierHash"",""type"":""ByteArray""},{""name"":""recipient"",""type"":""Hash160""},{""name"":""relayer"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""fee"",""type"":""Integer""}],""returntype"":""Void"",""offset"":3875,""safe"":false},{""name"":""onNEP17Payment"",""parameters"":[{""name"":""from"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""data"",""type"":""Any""}],""returntype"":""Void"",""offset"":5036,""safe"":false},{""name"":""_initialize"",""parameters"":[],""returntype"":""Void"",""offset"":5500,""safe"":false}],""events"":[{""name"":""PrivacyDeposit"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""stealthAddress"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""leaf"",""type"":""ByteArray""},{""name"":""index"",""type"":""Integer""}]},{""name"":""PrivacyWithdraw"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""recipient"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""nullifier"",""type"":""ByteArray""}]},{""name"":""OwnershipTransferred"",""parameters"":[{""name"":""previousOwner"",""type"":""Hash160""},{""name"":""newOwner"",""type"":""Hash160""}]},{""name"":""Paused"",""parameters"":[{""name"":""isPaused"",""type"":""Boolean""}]},{""name"":""MerkleRootUpdated"",""parameters"":[{""name"":""newRoot"",""type"":""ByteArray""},{""name"":""leafCount"",""type"":""Integer""}]},{""name"":""SecurityCouncilUpdated"",""parameters"":[{""name"":""previousCouncil"",""type"":""Hash160""},{""name"":""newCouncil"",""type"":""Hash160""}]}]},""permissions"":[{""contract"":""*"",""methods"":[""transfer"",""verify""]}],""trusts"":[],""extra"":{""Author"":""Neo Community"",""Description"":""zNEP-17 privacy vault for Neo N3 with zk-SNARK based private transfers."",""Version"":""0.1.0"",""nef"":{""optimization"":""Basic""}}}");

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
    public abstract void UpdateMerkleRoot(byte[]? newRoot);

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("withdraw")]
    public abstract void Withdraw(UInt160? asset, byte[]? proof, byte[]? publicInputs, byte[]? merkleRoot, byte[]? nullifierHash, UInt160? recipient, UInt160? relayer, BigInteger? amount, BigInteger? fee);

    #endregion
}
