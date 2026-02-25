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

    public static Neo.SmartContract.Manifest.ContractManifest Manifest => Neo.SmartContract.Manifest.ContractManifest.Parse(@"{""name"":""zNEP17Groth16Verifier"",""groups"":[],""features"":{},""supportedstandards"":[],""abi"":{""methods"":[{""name"":""verify"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""proof"",""type"":""ByteArray""},{""name"":""publicInputs"",""type"":""ByteArray""},{""name"":""merkleRoot"",""type"":""ByteArray""},{""name"":""nullifierHash"",""type"":""ByteArray""},{""name"":""commitment"",""type"":""ByteArray""},{""name"":""recipient"",""type"":""Hash160""},{""name"":""relayer"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""fee"",""type"":""Integer""}],""returntype"":""Boolean"",""offset"":0,""safe"":true},{""name"":""_initialize"",""parameters"":[],""returntype"":""Void"",""offset"":1593,""safe"":false}],""events"":[]},""permissions"":[{""contract"":""0x726cb6e0cd8628a1350a611384688911ab75f51b"",""methods"":[""bls12381Add"",""bls12381Deserialize"",""bls12381Equal"",""bls12381Mul"",""bls12381Pairing""]}],""trusts"":[],""extra"":{""Author"":""Neo Community"",""Description"":""zNEP-17 production Groth16 verifier over BLS12-381 on Neo N3."",""Version"":""1.0.0"",""nef"":{""optimization"":""Basic""}}}");

    /// <summary>
    /// Optimization: "Basic"
    /// </summary>
    public static Neo.SmartContract.NefFile Nef => Convert.FromBase64String(@"TkVGM05lby5Db21waWxlci5DU2hhcnAgMy45LjErNWZhOTU2NmU1MTY1ZWRlMjE2NWE5YmUxZjRhMDEyMGMxNzYuLi4AAAUb9XWrEYlohBNhCjWhKIbN4LZschNibHMxMjM4MURlc2VyaWFsaXplAQABDxv1dasRiWiEE2EKNaEohs3gtmxyC2JsczEyMzgxTXVsAwABDxv1dasRiWiEE2EKNaEohs3gtmxyC2JsczEyMzgxQWRkAgABDxv1dasRiWiEE2EKNaEohs3gtmxyD2JsczEyMzgxUGFpcmluZwIAAQ8b9XWrEYlohBNhCjWhKIbN4LZscg1ibHMxMjM4MUVxdWFsAgABDwAA/XcJVw0KeDVcAQAAqiYFCCIJfjVQAQAAqiYFCCIKfwc1QwEAAKomCAkjOQEAAHlwaAuXJgUIIgh5ygHAAJgmCAkjIQEAAHpwaAuXJgUIIgh6ygEAAZgmCAkjCQEAAHtwaAuXJgUIIgd7ygAgmCYICSPyAAAAfHBoC5cmBQgiB3zKACCYJggJI9sAAAB9cGgLlyYFCCIHfcoAIJgmCAkjxAAAAH8IELYmBQgiBn8JELUmBQgiB38Ifwm2JggJI6UAAAB4fwl/CH8Hfn18e3o1wQAAAKomCAkjiwAAAAAwEHk1+AMAAHAAYAAweTXtAwAAcQAwAZAAeTXhAwAAcmg3AABzaTcAAHRqNwAAdVo3AAB2WzcAAHcHXDcAAHcIXTcAAHcJejU3BAAAdwpsazcDAHcLbwduNwMAdwxvCG8KNwMAbww3AgBKdwxFbwltNwMAbww3AgBKdwxFbwxvCzcEACICQFcAAXhK2SgkBkUJIgbKABSzJAUJIgZ4ELOqQErZKCQGRQkiBsoAFLNAELNAVwAJC0pgfDXgAAAAqiYICSPWAAAAeTX9AQAAEHg1LgEAAKomCAkjwAAAAHo15wEAAAAgeDUXAQAAqiYICSOpAAAAWABAeDUFAQAAqiYICSOXAAAAC0pgfTWPAAAAqiYICSOFAAAAWABgeDXhAAAAqiYFCSJzC0phfjUcAgAAqiYFCSJkWQGAAHg1wgAAAKomBQkiVAtKYX8HNfwBAACqJgUJIkRZAaAAeDWiAAAAqiYFCSI0C0pgfwg0LqomBQkiJ1gBwAB4NYUAAACqJgUJIhd7NUEBAAAB4AB4NHCqJgUJIgUIIgJAVwICACCISmBFeNswcGjKABSYJgUJIksQcSI+aGnOSlhpUdBFaUqcSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn3FFaWjKtSTACCICQNswQFcBA3kQtSYICSO+AAAAeXrKnkoCAAAAgC4EIgpKAv///38yHgP/////AAAAAJFKAv///38yDAMAAAAAAQAAAJ94yrcmCAkjgQAAABBwInF4eWieSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn856aM6YJgUJIj5oSpxKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfcEVoesq1JI0IIgJAVwIBACCIcBBxIm94AB9pn0oCAAAAgC4EIgpKAv///38yHgP/////AAAAAJFKAv///38yDAMAAAAAAQAAAJ/OSmhpUdBFaUqcSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn3FFaQAgtSSPaCICQFcDAgAgiEphRXgQtSYICSOkAAAAeNswcGjKcWkAILcmTGkAIZckBQkiN2hpEZ9KAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfzhCXJgkAIEpxRSIFCSJKEHIiPmhqzkpZalHQRWpKnEoCAAAAgC4EIgpKAv///38yHgP/////AAAAAJFKAv///38yDAMAAAAAAQAAAJ9yRWpptSTBCCICQFcCA3qIcBBxIm54eWmeSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn85KaGlR0EVpSpxKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfcUVperUkkWgiAkA3AABAVwUBXhDONwAAcBBxI7kAAAAAIGkAIKBKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfeDU3////cl5pEZ5KAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfzjcAAHMJams3AQB0bGg3AgBKcEVpSpxKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfcUVpGLUlSf///2giAkA3AQBANwIAQDcDAEA3BABAVgcMMKePFEaA9xV66ysuZZc2lE5m4sZN5KA4Ztgkn1VhcfvBeNuJ7i4ubxWyPPgWPATbb9swYgxgohUiicjdwfhkpIXkPC3OF7zwgIvv8MwvemzVkNIHLmyR2udCjzTiDp2h2Rr9nPyDEWO8LXD/udQa8v8ogY5PkMletqVN45Sbds32FMgb5lP4mKUwiyXB6VbfGImahxLU2zBjDGCT4CtgUnGfYH2s06CIJ09lWWvQ0Jkgthq12mG73H9QSTNM8RITlF1X5ax9BV0EK34CSqKy8I8KkSYIBSctxRBRxuR61PpAOwK0UQtkeuPRdwusAyaoBbvv1IBWyMEhvbjbMGQMYJEJ/+Xny3nxS6rn8gyWiKNsg38G6Q6f8tUfJiuXLIk8iHmpv7MhoyBAnFmvwZgebRf+ql7F8vwYNvWV4z9GbOKk1Q6sMN5Dooal8XHKrk+0AI5/LpZ7uavLICfB/eW86tswZQwwpD5gBtnIdLFmI7ZH5VMLdkdL2FHHVZroN03FOyZ0w77/I78B6gaOMPhzFzaZ4uzY2zAMMJE8Du/3Hsf9UQGReFRQJP3uhMFrFJYkKjZeynrndPJ/kUfLupoIeJzxL9bCIAGtR9swDDCQ0LD8cBIQlF5vPVzxqi15JQNWZz23qwn6+HZ1fNosQUW7PYDmjRNvz6f8TT01nIXbMAwwlaVoqHRSVhruJsz4oMfQC5OrOVwiYQ2+4830lXSWr8IUxhwwOAyn1zesIT/gZDkI2zAMMLKQoFNKTBLnK36dtYC8bNzJE+OBAj9kzQBVgP2fMhbuj0Xrl3CuVngYFEFwbQWoRdswDDCHV6POzmjVw6BK43REzWyYuk6jTnDW1n9EIJRw3VH2iYnfXYD4MiWF8hTcqoF8oX/bMAwwsuMd4FvMjGf8QJJQkK1z2OcKRkIFTMzARGQ4oJZQt2E78E3YijJaogZ2Oc+/jmY12zAMMIW+FVKgXQ+7FdQrjKcSMVBdg+gSsiELZrvm3xD+QqPBEkGKhNSLPgCr76RqHu2AWdswDDC2dnIqKMGQ6g4Jf/Vvzj5pGGGiodG5FmVBp3A0DarGBDn+qaW2DcYbG/CouJ/c0yfbMBnAZkARYKg/").AsSerializable<Neo.SmartContract.NefFile>();

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
