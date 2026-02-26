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

    public static Neo.SmartContract.Manifest.ContractManifest Manifest => Neo.SmartContract.Manifest.ContractManifest.Parse(@"{""name"":""zNEP17Groth16Verifier"",""groups"":[],""features"":{},""supportedstandards"":[],""abi"":{""methods"":[{""name"":""verify"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""proof"",""type"":""ByteArray""},{""name"":""publicInputs"",""type"":""ByteArray""},{""name"":""merkleRoot"",""type"":""ByteArray""},{""name"":""nullifierHash"",""type"":""ByteArray""},{""name"":""newCommitment"",""type"":""ByteArray""},{""name"":""recipient"",""type"":""Hash160""},{""name"":""relayer"",""type"":""Hash160""},{""name"":""amountWithdraw"",""type"":""Integer""},{""name"":""fee"",""type"":""Integer""}],""returntype"":""Boolean"",""offset"":0,""safe"":true},{""name"":""_initialize"",""parameters"":[],""returntype"":""Void"",""offset"":1593,""safe"":false}],""events"":[]},""permissions"":[{""contract"":""0x726cb6e0cd8628a1350a611384688911ab75f51b"",""methods"":[""bls12381Add"",""bls12381Deserialize"",""bls12381Equal"",""bls12381Mul"",""bls12381Pairing""]}],""trusts"":[],""extra"":{""Author"":""Neo Community"",""Description"":""zNEP-17 production Groth16 verifier over BLS12-381 on Neo N3."",""Version"":""1.0.0"",""nef"":{""optimization"":""Basic""}}}");

    /// <summary>
    /// Optimization: "Basic"
    /// </summary>
    public static Neo.SmartContract.NefFile Nef => Convert.FromBase64String(@"TkVGM05lby5Db21waWxlci5DU2hhcnAgMy45LjErNWZhOTU2NmU1MTY1ZWRlMjE2NWE5YmUxZjRhMDEyMGMxNzYuLi4AAAUb9XWrEYlohBNhCjWhKIbN4LZschNibHMxMjM4MURlc2VyaWFsaXplAQABDxv1dasRiWiEE2EKNaEohs3gtmxyC2JsczEyMzgxTXVsAwABDxv1dasRiWiEE2EKNaEohs3gtmxyC2JsczEyMzgxQWRkAgABDxv1dasRiWiEE2EKNaEohs3gtmxyD2JsczEyMzgxUGFpcmluZwIAAQ8b9XWrEYlohBNhCjWhKIbN4LZscg1ibHMxMjM4MUVxdWFsAgABDwAA/XcJVw0KeDVcAQAAqiYFCCIJfjVQAQAAqiYFCCIKfwc1QwEAAKomCAkjOQEAAHlwaAuXJgUIIgh5ygHAAJgmCAkjIQEAAHpwaAuXJgUIIgh6ygEAAZgmCAkjCQEAAHtwaAuXJgUIIgd7ygAgmCYICSPyAAAAfHBoC5cmBQgiB3zKACCYJggJI9sAAAB9cGgLlyYFCCIHfcoAIJgmCAkjxAAAAH8IELYmBQgiBn8JELUmBQgiB38Ifwm2JggJI6UAAAB9eH8Jfwh/B358e3o1wQAAAKomCAkjiwAAAAAwEHk1+AMAAHAAYAAweTXtAwAAcQAwAZAAeTXhAwAAcmg3AABzaTcAAHRqNwAAdVo3AAB2WzcAAHcHXDcAAHcIXTcAAHcJejU3BAAAdwpsazcDAHcLbwduNwMAdwxvCG8KNwMAbww3AgBKdwxFbwltNwMAbww3AgBKdwxFbwxvCzcEACICQFcAAXhK2SgkBkUJIgbKABSzJAUJIgZ4ELOqQErZKCQGRQkiBsoAFLNAELNAVwAJC0pgezXgAAAAqiYICSPWAAAAeTX9AQAAEHg1LgEAAKomCAkjwAAAAHo15wEAAAAgeDUXAQAAqiYICSOpAAAAWABAeDUFAQAAqiYICSOXAAAAC0pgfDWPAAAAqiYICSOFAAAAWABgeDXhAAAAqiYFCSJzC0phfTUcAgAAqiYFCSJkC0phfjUNAgAAqiYFCSJVWQGAAHg1swAAAKomBQkiRVkBoAB4NaMAAACqJgUJIjULSmB/BzQvqiYFCSIoWAHAAHg1hgAAAKomBQkiGH8INUEBAAAB4AB4NHCqJgUJIgUIIgJAVwICACCISmBFeNswcGjKABSYJgUJIksQcSI+aGnOSlhpUdBFaUqcSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn3FFaWjKtSTACCICQNswQFcBA3kQtSYICSO+AAAAeXrKnkoCAAAAgC4EIgpKAv///38yHgP/////AAAAAJFKAv///38yDAMAAAAAAQAAAJ94yrcmCAkjgQAAABBwInF4eWieSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn856aM6YJgUJIj5oSpxKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfcEVoesq1JI0IIgJAVwIBACCIcBBxIm94AB9pn0oCAAAAgC4EIgpKAv///38yHgP/////AAAAAJFKAv///38yDAMAAAAAAQAAAJ/OSmhpUdBFaUqcSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn3FFaQAgtSSPaCICQFcDAgAgiEphRXgQtSYICSOkAAAAeNswcGjKcWkAILcmTGkAIZckBQkiN2hpEZ9KAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfzhCXJgkAIEpxRSIFCSJKEHIiPmhqzkpZalHQRWpKnEoCAAAAgC4EIgpKAv///38yHgP/////AAAAAJFKAv///38yDAMAAAAAAQAAAJ9yRWpptSTBCCICQFcCA3qIcBBxIm54eWmeSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn85KaGlR0EVpSpxKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfcUVperUkkWgiAkA3AABAVwUBXhDONwAAcBBxI7kAAAAAIGkAIKBKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfeDU3////cl5pEZ5KAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfzjcAAHMJams3AQB0bGg3AgBKcEVpSpxKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfcUVpGLUlSf///2giAkA3AQBANwIAQDcDAEA3BABAVgcMMKePFEaA9xV66ysuZZc2lE5m4sZN5KA4Ztgkn1VhcfvBeNuJ7i4ubxWyPPgWPATbb9swYgxgohUiicjdwfhkpIXkPC3OF7zwgIvv8MwvemzVkNIHLmyR2udCjzTiDp2h2Rr9nPyDEWO8LXD/udQa8v8ogY5PkMletqVN45Sbds32FMgb5lP4mKUwiyXB6VbfGImahxLU2zBjDGCT4CtgUnGfYH2s06CIJ09lWWvQ0Jkgthq12mG73H9QSTNM8RITlF1X5ax9BV0EK34CSqKy8I8KkSYIBSctxRBRxuR61PpAOwK0UQtkeuPRdwusAyaoBbvv1IBWyMEhvbjbMGQMYLlWhz9FAU8Sk2IzGFHGZV0LloF5F5+F6HQ8J9IsI/vjxX/5+n5gZ6+Px8J1LJpdLw9t0e8+DA0n4L/6FX+fNlQPZTLPw/60NuIPQU3baTqrNhhf2uSXYESdwbvpWEc83NswZQwwk9DeXk2apAQ7/2oAABT1/iezR3XHBDTNiw6ZoZYaVt4QADh62TZBtNxTGBvV+IwU2zAMMLd1gctp4bTkt7PjFmExFNwbD0QgHUf3affkxNeQR+CjjDRRn5C1gcQ3RaPaVpfNK9swDDCOMZ9cA1YITe0qDvCVhH24fxrZjaZjEMWM4RrrAv3BjxWG1WvIbUxbByfDyLf9ZLbbMAwwlLqT2p5LbQxLcPxzgRA7HpsKNJfeOyrreAxXBFt//iHOS5XXg4uChKyKjR7s1sqe2zAMMIqGtfAONdSUOvfwSkkhJWvhYTNEP1IHIonm/SQx6AqJ8lbxCotE2i2t+Ob6EKp8jdswDDCuMms02bC50MIMHRbOJT1HxpW20exnlpy/zSdAzlIPI9d0QWy48UgOKp2XAcoAdVXbMAwwryU2VdQRKR2GI7NSCPWhDy057UE68lA/YsSm20HNoChuLlu53AskR6vfShyjz7k22zAMMINgHmZXQq+imMTbZvWqPlvKF/1na9dD8PLL8yAGHvWol4mhPJ+zjxQtKGrIbflPqtswDDCRKzM44Y0rwqq7xd88s/D4++a9hIlcfgviP458dtuvI8YJyaqVfna2S6TZlTww5PbbMBnAZkCWvxiE").AsSerializable<Neo.SmartContract.NefFile>();

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
