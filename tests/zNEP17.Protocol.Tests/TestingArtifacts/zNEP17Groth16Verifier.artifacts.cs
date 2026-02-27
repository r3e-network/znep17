using Neo.Cryptography.ECC;
using Neo.Extensions;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Numerics;

#pragma warning disable CS0067

namespace Neo.SmartContract.Testing;

public abstract class zNEP17Groth16Verifier(Neo.SmartContract.Testing.SmartContractInitialize initialize) : Neo.SmartContract.Testing.SmartContract(initialize), IContractInfo
{
    #region Compiled data

    public static Neo.SmartContract.Manifest.ContractManifest Manifest => Neo.SmartContract.Manifest.ContractManifest.Parse(@"{""name"":""zNEP17Groth16Verifier"",""groups"":[],""features"":{},""supportedstandards"":[],""abi"":{""methods"":[{""name"":""verify"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""proof"",""type"":""ByteArray""},{""name"":""publicInputs"",""type"":""ByteArray""},{""name"":""merkleRoot"",""type"":""ByteArray""},{""name"":""nullifierHash"",""type"":""ByteArray""},{""name"":""newCommitment"",""type"":""ByteArray""},{""name"":""recipient"",""type"":""Hash160""},{""name"":""relayer"",""type"":""Hash160""},{""name"":""amountWithdraw"",""type"":""Integer""},{""name"":""fee"",""type"":""Integer""}],""returntype"":""Boolean"",""offset"":0,""safe"":true},{""name"":""verifyTreeUpdate"",""parameters"":[{""name"":""proof"",""type"":""ByteArray""},{""name"":""publicInputs"",""type"":""ByteArray""},{""name"":""oldRoot"",""type"":""ByteArray""},{""name"":""newRoot"",""type"":""ByteArray""},{""name"":""oldLeaf"",""type"":""ByteArray""},{""name"":""newLeaf"",""type"":""ByteArray""},{""name"":""leafIndex"",""type"":""Integer""}],""returntype"":""Boolean"",""offset"":1644,""safe"":true},{""name"":""_initialize"",""parameters"":[],""returntype"":""Void"",""offset"":2402,""safe"":false}],""events"":[]},""permissions"":[{""contract"":""0x726cb6e0cd8628a1350a611384688911ab75f51b"",""methods"":[""bls12381Add"",""bls12381Deserialize"",""bls12381Equal"",""bls12381Mul"",""bls12381Pairing""]}],""trusts"":[],""extra"":{""Author"":""R3E Network"",""Description"":""zNEP-17 production Groth16 verifier over BLS12-381 on Neo N3."",""Version"":""1.0.0"",""nef"":{""optimization"":""Basic""}}}");

    /// <summary>
    /// Optimization: "Basic"
    /// </summary>
    public static Neo.SmartContract.NefFile Nef => Convert.FromBase64String(@"TkVGM05lby5Db21waWxlci5DU2hhcnAgMy45LjErNWZhOTU2NmU1MTY1ZWRlMjE2NWE5YmUxZjRhMDEyMGMxNzYuLi4AAAUb9XWrEYlohBNhCjWhKIbN4LZschNibHMxMjM4MURlc2VyaWFsaXplAQABDxv1dasRiWiEE2EKNaEohs3gtmxyC2JsczEyMzgxTXVsAwABDxv1dasRiWiEE2EKNaEohs3gtmxyC2JsczEyMzgxQWRkAgABDxv1dasRiWiEE2EKNaEohs3gtmxyD2JsczEyMzgxUGFpcmluZwIAAQ8b9XWrEYlohBNhCjWhKIbN4LZscg1ibHMxMjM4MUVxdWFsAgABDwAA/UQPVw4KeDWBAQAAqiYFCCIJfjV1AQAAqiYFCCIKfwc1aAEAAKomCAkjXgEAAHlwaAuXJgUIIgh5ygHAAJgmCAkjRgEAAHpwaAuXJgUIIgh6ygEAAZgmCAkjLgEAAHtwaAuXJgUIIgd7ygAgmCYICSMXAQAAfHBoC5cmBQgiB3zKACCYJggJIwABAAB9cGgLlyYFCCIHfcoAIJgmCAkj6QAAAH8IELYmBQgiBn8JELUmBQgiB38Ifwm2JggJI8oAAAB9eH8Jfwh/B358e3o15gAAAKomCAkjsAAAAAAwEHk1KwQAAHAAYAAweTUgBAAAcQAwAZAAeTUUBAAAcmg3AABzaTcAAHRqNwAAdVo3AAB2WzcAAHcHXDcAAHcIXTcAAHcJejVqBAAAdwpsazcDAHcLbwduNwMAdwxvCG8KNwMAbww3AgBKdwxFbwltNwMAbww3AgBKdwxFbwxvCzcEAHcNbw2qJh4JJBsMFlBhaXJpbmcgcmV0dXJuZWQgRkFMU0Xgbw0iAkBXAAF4StkoJAZFCSIGygAUsyQFCSIGeBCzqkBK2SgkBkUJIgbKABSzQBCzQFcFCXk1uQEAABB4NeoAAACqJggJI+AAAAB6NaMBAAAAIHg10wAAAKomCAkjyQAAAAAgiHALSmB7NQcCAACqJggJI7MAAABYAEB4NasAAACqJggJI6EAAAAAIIhxC0pgfDXfAQAAqiYICSOLAAAAWABgeDWDAAAAqiYFCSJ5ACCIcgtKYX41HgIAAKomBQkiZlkBgAB4NGCqJgUJIlkAIIhzC0pgfwc1mQEAAKomBQkiRVgBoAB4ND+qJgUJIjgAIIh0C0phfTXdAQAAqiYFCSIlWQHAAHg0H6omBQkiGH8INd0AAAAB4AB4NAyqJgUJIgUIIgJAVwEDeRC1JggJI74AAAB5esqeSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn3jKtyYICSOBAAAAEHAicXh5aJ5KAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfznpozpgmBQkiPmhKnEoCAAAAgC4EIgpKAv///38yHgP/////AAAAAJFKAv///38yDAMAAAAAAQAAAJ9wRWh6yrUkjQgiAkBXAgEAIIhwEHEib3gAH2mfSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn85KaGlR0EVpSpxKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfcUVpACC1JI9oIgJAVwICACCISmBFeNswcGjKABSYJgUJIksQcSI+aGnOSlhpUdBFaUqcSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn3FFaWjKtSTACCICQNswQFcDAgAgiEphRXgQtSYICSOkAAAAeNswcGjKcWkAILcmTGkAIZckBQkiN2hpEZ9KAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfzhCXJgkAIEpxRSIFCSJKEHIiPmhqzkpZalHQRWpKnEoCAAAAgC4EIgpKAv///38yHgP/////AAAAAJFKAv///38yDAMAAAAAAQAAAJ9yRWpptSTBCCICQFcCA3qIcBBxIm54eWmeSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn85KaGlR0EVpSpxKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfcUVperUkkWgiAkA3AABAVwUBXhDONwAAcBBxI7kAAAAAIGkAIKBKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfeDU3////cl5pEZ5KAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL/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").AsSerializable<Neo.SmartContract.NefFile>();

    #endregion

    #region Safe methods

    /// <summary>
    /// Safe method
    /// </summary>
    [DisplayName("verify")]
    public abstract bool? Verify(UInt160? asset, byte[]? proof, byte[]? publicInputs, byte[]? merkleRoot, byte[]? nullifierHash, byte[]? newCommitment, UInt160? recipient, UInt160? relayer, BigInteger? amountWithdraw, BigInteger? fee);

    /// <summary>
    /// Safe method
    /// </summary>
    [DisplayName("verifyTreeUpdate")]
    public abstract bool? VerifyTreeUpdate(byte[]? proof, byte[]? publicInputs, byte[]? oldRoot, byte[]? newRoot, byte[]? oldLeaf, byte[]? newLeaf, BigInteger? leafIndex);

    #endregion

    #region Unsafe methods

    #endregion
}
