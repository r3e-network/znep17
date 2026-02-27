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

    public static Neo.SmartContract.Manifest.ContractManifest Manifest => Neo.SmartContract.Manifest.ContractManifest.Parse(@"{""name"":""zNEP17Protocol"",""groups"":[],""features"":{},""supportedstandards"":[""zNEP-17""],""abi"":{""methods"":[{""name"":""_deploy"",""parameters"":[{""name"":""data"",""type"":""Any""},{""name"":""update"",""type"":""Boolean""}],""returntype"":""Void"",""offset"":0,""safe"":false},{""name"":""isPaused"",""parameters"":[],""returntype"":""Boolean"",""offset"":61,""safe"":true},{""name"":""setPaused"",""parameters"":[{""name"":""paused"",""type"":""Boolean""}],""returntype"":""Void"",""offset"":110,""safe"":false},{""name"":""getOwner"",""parameters"":[],""returntype"":""Hash160"",""offset"":204,""safe"":true},{""name"":""getPendingOwner"",""parameters"":[],""returntype"":""Hash160"",""offset"":354,""safe"":true},{""name"":""transferOwnership"",""parameters"":[{""name"":""newOwner"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":414,""safe"":false},{""name"":""acceptOwnership"",""parameters"":[],""returntype"":""Void"",""offset"":465,""safe"":false},{""name"":""getVerifier"",""parameters"":[],""returntype"":""Hash160"",""offset"":681,""safe"":true},{""name"":""getRelayer"",""parameters"":[],""returntype"":""Hash160"",""offset"":741,""safe"":true},{""name"":""getSecurityCouncil"",""parameters"":[],""returntype"":""Hash160"",""offset"":615,""safe"":true},{""name"":""getPendingSecurityCouncil"",""parameters"":[],""returntype"":""Hash160"",""offset"":801,""safe"":true},{""name"":""getPendingSecurityCouncilReadyAt"",""parameters"":[],""returntype"":""Integer"",""offset"":862,""safe"":true},{""name"":""getPendingVerifier"",""parameters"":[],""returntype"":""Hash160"",""offset"":908,""safe"":true},{""name"":""getPendingVerifierReadyAt"",""parameters"":[],""returntype"":""Integer"",""offset"":969,""safe"":true},{""name"":""getPendingRelayer"",""parameters"":[],""returntype"":""Hash160"",""offset"":1004,""safe"":true},{""name"":""getPendingRelayerReadyAt"",""parameters"":[],""returntype"":""Integer"",""offset"":1065,""safe"":true},{""name"":""getLeafIndex"",""parameters"":[],""returntype"":""Integer"",""offset"":1100,""safe"":true},{""name"":""getCurrentRoot"",""parameters"":[],""returntype"":""ByteArray"",""offset"":1134,""safe"":true},{""name"":""getLastRootLeafCount"",""parameters"":[],""returntype"":""Integer"",""offset"":1162,""safe"":true},{""name"":""isKnownRoot"",""parameters"":[{""name"":""root"",""type"":""ByteArray""}],""returntype"":""Boolean"",""offset"":1197,""safe"":true},{""name"":""isNullifierUsed"",""parameters"":[{""name"":""nullifierHash"",""type"":""ByteArray""}],""returntype"":""Boolean"",""offset"":1284,""safe"":true},{""name"":""getAssetEscrowBalance"",""parameters"":[{""name"":""asset"",""type"":""Hash160""}],""returntype"":""Integer"",""offset"":1344,""safe"":true},{""name"":""isAssetAllowed"",""parameters"":[{""name"":""asset"",""type"":""Hash160""}],""returntype"":""Boolean"",""offset"":1412,""safe"":true},{""name"":""getLeaf"",""parameters"":[{""name"":""index"",""type"":""Integer""}],""returntype"":""ByteArray"",""offset"":1466,""safe"":true},{""name"":""getCommitmentIndex"",""parameters"":[{""name"":""commitment"",""type"":""ByteArray""}],""returntype"":""Integer"",""offset"":1518,""safe"":true},{""name"":""getRootLeafCount"",""parameters"":[{""name"":""root"",""type"":""ByteArray""}],""returntype"":""Integer"",""offset"":1575,""safe"":true},{""name"":""setVerifier"",""parameters"":[{""name"":""verifier"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":1652,""safe"":false},{""name"":""scheduleVerifierUpdate"",""parameters"":[{""name"":""verifier"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":1768,""safe"":false},{""name"":""applyVerifierUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":1989,""safe"":false},{""name"":""cancelVerifierUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2110,""safe"":false},{""name"":""setRelayer"",""parameters"":[{""name"":""relayer"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":2135,""safe"":false},{""name"":""scheduleRelayerUpdate"",""parameters"":[{""name"":""relayer"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":2249,""safe"":false},{""name"":""applyRelayerUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2391,""safe"":false},{""name"":""cancelRelayerUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2513,""safe"":false},{""name"":""setSecurityCouncil"",""parameters"":[{""name"":""council"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":2538,""safe"":false},{""name"":""scheduleSecurityCouncilUpdate"",""parameters"":[{""name"":""council"",""type"":""Hash160""}],""returntype"":""Void"",""offset"":2702,""safe"":false},{""name"":""applySecurityCouncilUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":2918,""safe"":false},{""name"":""cancelSecurityCouncilUpdate"",""parameters"":[],""returntype"":""Void"",""offset"":3144,""safe"":false},{""name"":""setAssetAllowed"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""allowed"",""type"":""Boolean""}],""returntype"":""Void"",""offset"":3169,""safe"":false},{""name"":""updateMerkleRoot"",""parameters"":[{""name"":""proof"",""type"":""ByteArray""},{""name"":""publicInputs"",""type"":""ByteArray""},{""name"":""newRoot"",""type"":""ByteArray""}],""returntype"":""Void"",""offset"":3272,""safe"":false},{""name"":""withdraw"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""proof"",""type"":""ByteArray""},{""name"":""publicInputs"",""type"":""ByteArray""},{""name"":""merkleRoot"",""type"":""ByteArray""},{""name"":""nullifierHash"",""type"":""ByteArray""},{""name"":""newCommitment"",""type"":""ByteArray""},{""name"":""recipient"",""type"":""Hash160""},{""name"":""relayer"",""type"":""Hash160""},{""name"":""amountWithdraw"",""type"":""Integer""},{""name"":""fee"",""type"":""Integer""}],""returntype"":""Void"",""offset"":3932,""safe"":false},{""name"":""onNEP17Payment"",""parameters"":[{""name"":""from"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""data"",""type"":""Any""}],""returntype"":""Void"",""offset"":5318,""safe"":false},{""name"":""_initialize"",""parameters"":[],""returntype"":""Void"",""offset"":5820,""safe"":false}],""events"":[{""name"":""PrivacyDeposit"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""stealthAddress"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""leaf"",""type"":""ByteArray""},{""name"":""index"",""type"":""Integer""}]},{""name"":""PrivacyWithdraw"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""recipient"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""nullifier"",""type"":""ByteArray""}]},{""name"":""OwnershipTransferred"",""parameters"":[{""name"":""previousOwner"",""type"":""Hash160""},{""name"":""newOwner"",""type"":""Hash160""}]},{""name"":""Paused"",""parameters"":[{""name"":""isPaused"",""type"":""Boolean""}]},{""name"":""MerkleRootUpdated"",""parameters"":[{""name"":""newRoot"",""type"":""ByteArray""},{""name"":""leafCount"",""type"":""Integer""}]},{""name"":""SecurityCouncilUpdated"",""parameters"":[{""name"":""previousCouncil"",""type"":""Hash160""},{""name"":""newCouncil"",""type"":""Hash160""}]}]},""permissions"":[{""contract"":""*"",""methods"":[""transfer"",""verify"",""verifyTreeUpdate""]}],""trusts"":[],""extra"":{""Author"":""R3E Network"",""Description"":""zNEP-17 privacy vault for Neo N3 with zk-SNARK based private transfers."",""Version"":""0.1.0"",""nef"":{""optimization"":""Basic""}}}");

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
    public abstract void UpdateMerkleRoot(byte[]? proof, byte[]? publicInputs, byte[]? newRoot);

    /// <summary>
    /// Unsafe method
    /// </summary>
    [DisplayName("withdraw")]
    public abstract void Withdraw(UInt160? asset, byte[]? proof, byte[]? publicInputs, byte[]? merkleRoot, byte[]? nullifierHash, byte[]? newCommitment, UInt160? recipient, UInt160? relayer, BigInteger? amountWithdraw, BigInteger? fee);

    #endregion
}
