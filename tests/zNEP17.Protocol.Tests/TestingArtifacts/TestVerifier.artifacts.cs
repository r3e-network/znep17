using Neo.Cryptography.ECC;
using Neo.Extensions;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Numerics;

#pragma warning disable CS0067

namespace Neo.SmartContract.Testing;

public abstract class TestVerifier(Neo.SmartContract.Testing.SmartContractInitialize initialize) : Neo.SmartContract.Testing.SmartContract(initialize), IContractInfo
{
    #region Compiled data

    public static Neo.SmartContract.Manifest.ContractManifest Manifest => Neo.SmartContract.Manifest.ContractManifest.Parse(@"{""name"":""TestVerifier"",""groups"":[],""features"":{},""supportedstandards"":[],""abi"":{""methods"":[{""name"":""_deploy"",""parameters"":[{""name"":""data"",""type"":""Any""},{""name"":""update"",""type"":""Boolean""}],""returntype"":""Void"",""offset"":0,""safe"":false},{""name"":""setResult"",""parameters"":[{""name"":""result"",""type"":""Boolean""}],""returntype"":""Void"",""offset"":52,""safe"":false},{""name"":""getResult"",""parameters"":[],""returntype"":""Boolean"",""offset"":177,""safe"":true},{""name"":""verify"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""proof"",""type"":""ByteArray""},{""name"":""publicInputs"",""type"":""ByteArray""},{""name"":""merkleRoot"",""type"":""ByteArray""},{""name"":""nullifierHash"",""type"":""ByteArray""},{""name"":""commitment"",""type"":""ByteArray""},{""name"":""recipient"",""type"":""Hash160""},{""name"":""relayer"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""fee"",""type"":""Integer""}],""returntype"":""Boolean"",""offset"":224,""safe"":true},{""name"":""_initialize"",""parameters"":[],""returntype"":""Void"",""offset"":412,""safe"":false}],""events"":[]},""permissions"":[{""contract"":""*"",""methods"":""*""}],""trusts"":[],""extra"":{""nef"":{""optimization"":""Basic""}}}");

    /// <summary>
    /// Optimization: "Basic"
    /// </summary>
    public static Neo.SmartContract.NefFile Nef => Convert.FromBase64String(@"TkVGM05lby5Db21waWxlci5DU2hhcnAgMy45LjErNWZhOTU2NmU1MTY1ZWRlMjE2NWE5YmUxZjRhMDEyMGMxNzYuLi4AAAAAAP2rAVcAAnkmBCIYQS1RCDATztswWEE5DOMKEVlBOQzjCkBBOQzjCkDbMEBBLVEIMEBBOQzjCkBXAQFYQdWNXujbMNsoStgkCUrKABQoAzpwaDQxOWhB+CfsjDl4JgURIgMQWUE5DOMKQNsoStgkCUrKABQoAzpA2zBAQdWNXuhAOUBXAAF4StkoJAZFCSIGygAUsyQFCSIGeBCzqkBK2SgkBkUJIgbKABSzQBCzQEH4J+yMQFcCAFlB1Y1e6HBocWkLlyYFCCIPaErYJgZFECIE2yEQmCICQErYJgZFECIE2yFAVwEKNM6qJggJI7IAAAB4NJCqJgUIIgZ+NIeqJgUIIgp/BzV9////qiYICSOQAAAAeXBoC5cmBQgiBnnKEJcmBQgiB3kQzhGYJgUJInB6cGgLlyYFCCIGesoQlyYFCSJde3BoC5cmBQgiB3vKACCYJgUJIkl8cGgLlyYFCCIHfMoAIJgmBQkiNX1waAuXJgUIIgd9ygAgmCYFCSIhfwgQtiYFCCIGfwkQtSYFCCIHfwh/CbYmBQkiBQgiAkBWAgwBAdswYAwBAtswYUB2ge60").AsSerializable<Neo.SmartContract.NefFile>();

    #endregion

    #region Properties

    /// <summary>
    /// Safe property
    /// </summary>
    public abstract bool? Result { [DisplayName("getResult")] get; [DisplayName("setResult")] set; }

    #endregion

    #region Safe methods

    /// <summary>
    /// Safe method
    /// </summary>
    [DisplayName("verify")]
    public abstract bool? Verify(UInt160? asset, byte[]? proof, byte[]? publicInputs, byte[]? merkleRoot, byte[]? nullifierHash, byte[]? commitment, UInt160? recipient, UInt160? relayer, BigInteger? amount, BigInteger? fee);

    #endregion

    #region Unsafe methods

    #endregion
}
