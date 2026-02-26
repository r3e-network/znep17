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

    public static Neo.SmartContract.Manifest.ContractManifest Manifest => Neo.SmartContract.Manifest.ContractManifest.Parse(@"{""name"":""zNEP17Groth16Verifier"",""groups"":[],""features"":{},""supportedstandards"":[],""abi"":{""methods"":[{""name"":""verify"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""proof"",""type"":""ByteArray""},{""name"":""publicInputs"",""type"":""ByteArray""},{""name"":""merkleRoot"",""type"":""ByteArray""},{""name"":""nullifierHash"",""type"":""ByteArray""},{""name"":""newCommitment"",""type"":""ByteArray""},{""name"":""recipient"",""type"":""Hash160""},{""name"":""relayer"",""type"":""Hash160""},{""name"":""amountWithdraw"",""type"":""Integer""},{""name"":""fee"",""type"":""Integer""}],""returntype"":""Boolean"",""offset"":0,""safe"":true},{""name"":""_initialize"",""parameters"":[],""returntype"":""Void"",""offset"":1644,""safe"":false}],""events"":[]},""permissions"":[{""contract"":""0x726cb6e0cd8628a1350a611384688911ab75f51b"",""methods"":[""bls12381Add"",""bls12381Deserialize"",""bls12381Equal"",""bls12381Mul"",""bls12381Pairing""]}],""trusts"":[],""extra"":{""Author"":""Neo Community"",""Description"":""zNEP-17 production Groth16 verifier over BLS12-381 on Neo N3."",""Version"":""1.0.0"",""nef"":{""optimization"":""Basic""}}}");

    /// <summary>
    /// Optimization: "Basic"
    /// </summary>
    public static Neo.SmartContract.NefFile Nef => Convert.FromBase64String(@"TkVGM05lby5Db21waWxlci5DU2hhcnAgMy45LjErNWZhOTU2NmU1MTY1ZWRlMjE2NWE5YmUxZjRhMDEyMGMxNzYuLi4AAAUb9XWrEYlohBNhCjWhKIbN4LZschNibHMxMjM4MURlc2VyaWFsaXplAQABDxv1dasRiWiEE2EKNaEohs3gtmxyC2JsczEyMzgxTXVsAwABDxv1dasRiWiEE2EKNaEohs3gtmxyC2JsczEyMzgxQWRkAgABDxv1dasRiWiEE2EKNaEohs3gtmxyD2JsczEyMzgxUGFpcmluZwIAAQ8b9XWrEYlohBNhCjWhKIbN4LZscg1ibHMxMjM4MUVxdWFsAgABDwAA/aoJVw4KeDWBAQAAqiYFCCIJfjV1AQAAqiYFCCIKfwc1aAEAAKomCAkjXgEAAHlwaAuXJgUIIgh5ygHAAJgmCAkjRgEAAHpwaAuXJgUIIgh6ygEAAZgmCAkjLgEAAHtwaAuXJgUIIgd7ygAgmCYICSMXAQAAfHBoC5cmBQgiB3zKACCYJggJIwABAAB9cGgLlyYFCCIHfcoAIJgmCAkj6QAAAH8IELYmBQgiBn8JELUmBQgiB38Ifwm2JggJI8oAAAB9eH8Jfwh/B358e3o15gAAAKomCAkjsAAAAAAwEHk1KwQAAHAAYAAweTUgBAAAcQAwAZAAeTUUBAAAcmg3AABzaTcAAHRqNwAAdVo3AAB2WzcAAHcHXDcAAHcIXTcAAHcJejVqBAAAdwpsazcDAHcLbwduNwMAdwxvCG8KNwMAbww3AgBKdwxFbwltNwMAbww3AgBKdwxFbwxvCzcEAHcNbw2qJh4JJBsMFlBhaXJpbmcgcmV0dXJuZWQgRkFMU0Xgbw0iAkBXAAF4StkoJAZFCSIGygAUsyQFCSIGeBCzqkBK2SgkBkUJIgbKABSzQBCzQFcFCXk1uQEAABB4NeoAAACqJggJI+AAAAB6NaMBAAAAIHg10wAAAKomCAkjyQAAAAAgiHALSmB7NQcCAACqJggJI7MAAABYAEB4NasAAACqJggJI6EAAAAAIIhxC0pgfDXfAQAAqiYICSOLAAAAWABgeDWDAAAAqiYFCSJ5ACCIcgtKYX41HgIAAKomBQkiZlkBgAB4NGCqJgUJIlkAIIhzC0pgfwc1mQEAAKomBQkiRVgBoAB4ND+qJgUJIjgAIIh0C0phfTXdAQAAqiYFCSIlWQHAAHg0H6omBQkiGH8INd0AAAAB4AB4NAyqJgUJIgUIIgJAVwEDeRC1JggJI74AAAB5esqeSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn3jKtyYICSOBAAAAEHAicXh5aJ5KAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfznpozpgmBQkiPmhKnEoCAAAAgC4EIgpKAv///38yHgP/////AAAAAJFKAv///38yDAMAAAAAAQAAAJ9wRWh6yrUkjQgiAkBXAgEAIIhwEHEib3gAH2mfSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn85KaGlR0EVpSpxKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfcUVpACC1JI9oIgJAVwICACCISmBFeNswcGjKABSYJgUJIksQcSI+aGnOSlhpUdBFaUqcSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn3FFaWjKtSTACCICQNswQFcDAgAgiEphRXgQtSYICSOkAAAAeNswcGjKcWkAILcmTGkAIZckBQkiN2hpEZ9KAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfzhCXJgkAIEpxRSIFCSJKEHIiPmhqzkpZalHQRWpKnEoCAAAAgC4EIgpKAv///38yHgP/////AAAAAJFKAv///38yDAMAAAAAAQAAAJ9yRWpptSTBCCICQFcCA3qIcBBxIm54eWmeSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn85KaGlR0EVpSpxKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfcUVperUkkWgiAkA3AABAVwUBXhDONwAAcBBxI7kAAAAAIGkAIKBKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfeDU3////cl5pEZ5KAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfzjcAAHMJams3AQB0bGg3AgBKcEVpSpxKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfcUVpGLUlSf///2giAkA3AQBANwIAQDcDAEA3BABAVgcMMKePFEaA9xV66ysuZZc2lE5m4sZN5KA4Ztgkn1VhcfvBeNuJ7i4ubxWyPPgWPATbb9swYgxgohUiicjdwfhkpIXkPC3OF7zwgIvv8MwvemzVkNIHLmyR2udCjzTiDp2h2Rr9nPyDEWO8LXD/udQa8v8ogY5PkMletqVN45Sbds32FMgb5lP4mKUwiyXB6VbfGImahxLU2zBjDGCT4CtgUnGfYH2s06CIJ09lWWvQ0Jkgthq12mG73H9QSTNM8RITlF1X5ax9BV0EK34CSqKy8I8KkSYIBSctxRBRxuR61PpAOwK0UQtkeuPRdwusAyaoBbvv1IBWyMEhvbjbMGQMYLAbc1JdZXSuUG/EvOmRgO+FDQWzcdzFWaVILwlJRKv+8qF57qcmCyKcs08u7x6HEQLDHGaQi7mt/yXmeULgNt61rhA6LD67e4xn9h5KQjdYgNCxH/6Gc9sLc+p+JiKj2tswZQwwubNMPftRf0ALRjmoOwgh1zkK7pdJiT8eE3hdBT3a+ay+fIIX05vqtohwQDuhWl4V2zAMMKZJGU6QxL94e2pK+8n4FYfdHxi9LnnwRDqFpEMJkQXhgse+Obfq3Xf18ng1bNdXl9swDDCKqM3lSZ/eOGjrnQgPgO6TlN2LIj+We+HCLEPLCuVAtZ1/Q0n2M5HH2XGXYLZowqXbMAwwosxT9kqh7oCSJJdMu4wFFpW8iPpvypKMaF1uPXTsYx1e7qrkG3WGFa/3dz0j0Lsp2zAMMLhnD0LUhJXT1CjRs7aZ9wTyC59lc2YqGFUVLmrMxxGMIDmAn2RxZxjMgO4q7EygJtswDDC2KlCdRiZ0nhWLEAESY3evkDHqm13iGt3EXZsEfyEGf/cwetScebEtJkL6AY8ttljbMAwwrZbxe6rDBGok6ZD0NYid3yAuHbWJ/qOgtA7dUAFryHklllztO2cmrQjYN3Jwiq242zAMMKEabI6XZow/YmjnBBsy4g9hMRDuQDp6ikPK+l1L2Z5N48mxW1PYvNERpr6qHLx3rNswDDC1Qn/Y62ShCOjyTLF8gUfksthy5m9hTQfL6SWls1wB+XDl/jVdJpWAJTIX6LXkY/XbMBnAZkDZPOnY").AsSerializable<Neo.SmartContract.NefFile>();

    #endregion

    #region Safe methods

    /// <summary>
    /// Safe method
    /// </summary>
    [DisplayName("verify")]
    public abstract bool? Verify(UInt160? asset, byte[]? proof, byte[]? publicInputs, byte[]? merkleRoot, byte[]? nullifierHash, byte[]? newCommitment, UInt160? recipient, UInt160? relayer, BigInteger? amountWithdraw, BigInteger? fee);

    #endregion

    #region Unsafe methods

    #endregion
}
