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

    public static Neo.SmartContract.Manifest.ContractManifest Manifest => Neo.SmartContract.Manifest.ContractManifest.Parse(@"{""name"":""zNEP17Groth16Verifier"",""groups"":[],""features"":{},""supportedstandards"":[],""abi"":{""methods"":[{""name"":""verify"",""parameters"":[{""name"":""asset"",""type"":""Hash160""},{""name"":""proof"",""type"":""ByteArray""},{""name"":""publicInputs"",""type"":""ByteArray""},{""name"":""merkleRoot"",""type"":""ByteArray""},{""name"":""nullifierHash"",""type"":""ByteArray""},{""name"":""recipient"",""type"":""Hash160""},{""name"":""relayer"",""type"":""Hash160""},{""name"":""amount"",""type"":""Integer""},{""name"":""fee"",""type"":""Integer""}],""returntype"":""Boolean"",""offset"":0,""safe"":true},{""name"":""_initialize"",""parameters"":[],""returntype"":""Void"",""offset"":1536,""safe"":false}],""events"":[]},""permissions"":[{""contract"":""0x726cb6e0cd8628a1350a611384688911ab75f51b"",""methods"":[""bls12381Add"",""bls12381Deserialize"",""bls12381Equal"",""bls12381Mul"",""bls12381Pairing""]}],""trusts"":[],""extra"":{""Author"":""Neo Community"",""Description"":""zNEP-17 production Groth16 verifier over BLS12-381 on Neo N3."",""Version"":""1.0.0"",""nef"":{""optimization"":""Basic""}}}");

    /// <summary>
    /// Optimization: "Basic"
    /// </summary>
    public static Neo.SmartContract.NefFile Nef => Convert.FromBase64String(@"TkVGM05lby5Db21waWxlci5DU2hhcnAgMy45LjErNWZhOTU2NmU1MTY1ZWRlMjE2NWE5YmUxZjRhMDEyMGMxNzYuLi4AAAUb9XWrEYlohBNhCjWhKIbN4LZschNibHMxMjM4MURlc2VyaWFsaXplAQABDxv1dasRiWiEE2EKNaEohs3gtmxyC2JsczEyMzgxTXVsAwABDxv1dasRiWiEE2EKNaEohs3gtmxyC2JsczEyMzgxQWRkAgABDxv1dasRiWiEE2EKNaEohs3gtmxyD2JsczEyMzgxUGFpcmluZwIAAQ8b9XWrEYlohBNhCjWhKIbN4LZscg1ibHMxMjM4MUVxdWFsAgABDwAA/QoJVw0JeDVCAQAAqiYFCCIJfTU2AQAAqiYFCCIJfjUqAQAAqiYICSMgAQAAeXBoC5cmBQgiCHnKAcAAmCYICSMIAQAAenBoC5cmBQgiCHrKAeAAmCYICSPwAAAAe3BoC5cmBQgiB3vKACCYJggJI9kAAAB8cGgLlyYFCCIHfMoAIJgmCAkjwgAAAH8HELYmBQgiBn8IELUmBQgiB38Hfwi2JggJI6MAAAB4fwh/B359fHt6NcEAAACqJggJI4sAAAAAMBB5NdkDAABwAGAAMHk1zgMAAHEAMAGQAHk1wgMAAHJoNwAAc2k3AAB0ajcAAHVaNwAAdls3AAB3B1w3AAB3CF03AAB3CXo1GAQAAHcKbGs3AwB3C28HbjcDAHcMbwhvCjcDAG8MNwIASncMRW8JbTcDAG8MNwIASncMRW8Mbws3BAAiAkBXAAF4StkoJAZFCSIGygAUsyQFCSIGeBCzqkBK2SgkBkUJIgbKABSzQBCzQFcACAtKYHs1wQAAAKomCAkjtwAAAHk13gEAABB4NQ8BAACqJggJI6EAAAB6NcgBAAAAIHg1+AAAAKomCAkjigAAAFgAQHg15gAAAKomBQkieAtKYHw0c6omBQkibFgAYHg1ywAAAKomBQkiXQtKYX01BgIAAKomBQkiTlkBgAB4NawAAACqJgUJIj4LSmF+NecBAACqJgUJIi9ZAaAAeDWNAAAAqiYFCSIfC0pgfwc0GaomBQkiElgBwAB4NHCqJgUJIgUIIgJAVwICACCISmBFeNswcGjKABSYJgUJIksQcSI+aGnOSlhpUdBFaUqcSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn3FFaWjKtSTACCICQNswQFcBA3kQtSYICSO+AAAAeXrKnkoCAAAAgC4EIgpKAv///38yHgP/////AAAAAJFKAv///38yDAMAAAAAAQAAAJ94yrcmCAkjgQAAABBwInF4eWieSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn856aM6YJgUJIj5oSpxKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfcEVoesq1JI0IIgJAVwIBACCIcBBxIm94AB9pn0oCAAAAgC4EIgpKAv///38yHgP/////AAAAAJFKAv///38yDAMAAAAAAQAAAJ/OSmhpUdBFaUqcSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn3FFaQAgtSSPaCICQFcDAgAgiEphRXgQtSYICSOkAAAAeNswcGjKcWkAILcmTGkAIZckBQkiN2hpEZ9KAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfzhCXJgkAIEpxRSIFCSJKEHIiPmhqzkpZalHQRWpKnEoCAAAAgC4EIgpKAv///38yHgP/////AAAAAJFKAv///38yDAMAAAAAAQAAAJ9yRWpptSTBCCICQFcCA3qIcBBxIm54eWmeSgIAAACALgQiCkoC////fzIeA/////8AAAAAkUoC////fzIMAwAAAAABAAAAn85KaGlR0EVpSpxKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfcUVperUkkWgiAkA3AABAVwUBXhDONwAAcBBxI7kAAAAAIGkAIKBKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfeDU3////cl5pEZ5KAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfzjcAAHMJams3AQB0bGg3AgBKcEVpSpxKAgAAAIAuBCIKSgL///9/Mh4D/////wAAAACRSgL///9/MgwDAAAAAAEAAACfcUVpF7UlSf///2giAkA3AQBANwIAQDcDAEA3BABAVgcMMKePFEaA9xV66ysuZZc2lE5m4sZN5KA4Ztgkn1VhcfvBeNuJ7i4ubxWyPPgWPATbb9swYgxgohUiicjdwfhkpIXkPC3OF7zwgIvv8MwvemzVkNIHLmyR2udCjzTiDp2h2Rr9nPyDEWO8LXD/udQa8v8ogY5PkMletqVN45Sbds32FMgb5lP4mKUwiyXB6VbfGImahxLU2zBjDGCT4CtgUnGfYH2s06CIJ09lWWvQ0Jkgthq12mG73H9QSTNM8RITlF1X5ax9BV0EK34CSqKy8I8KkSYIBSctxRBRxuR61PpAOwK0UQtkeuPRdwusAyaoBbvv1IBWyMEhvbjbMGQMYIUqOyMapYv7bNd0xvXVcp9povS/RaCnAjJT9gx+PoGwEQF0wp43lQSDfHLwkPRQYgV/pXAzrsvNwMrmUGBYMBfXa23CHYlI8crV3LJiZ/zIZ7AsQLkQVNMDNczMGxOu5NswZQwwrb5wbBT/KC+psknCp1np/qklEvxtdQGGLWBISZyW6+xI5FY2khdWqLn/Ya0O9QuR2zAMMKgUPpXSPG6uPEk7sEobsSn+JKNjMuxB1T/p9G6ohGsy2F8XPgX2Hcu+wp54nDc3sdswDDCtgGF8bDhjGN3wKvFJdetRBU36Dt1zN63MzWfuowsYPNHRtAJVoo185MP5y00y2HHbMAwwtec4GUj+J8wTfheEYAwhoULJIyVzPZF7fjRdmyAMndpXmYezDhMBSqSH1XjCxdnt2zAMMLTXHRHd02FOW+jffC4UhnYZyiLa6IOkaFJMk7gM8k4/wdzV7U8um0+i4d8gLxwOjdswDDCY1pOG072Zmazhhpy/G++gMfzhYXaM9++KjQkkUjsCFuxhvq/Ly2t7jEJQPmRfc8XbMAwwkp8PMIEPq0xVdjzFVV8/v4LMkvvqILjLnffT/5CaBojT2ZQZCaFPIGktBJbxUk802zAMMKwwC7yHvmhS6yEjjr32FIvHYqe9lpFdfh/BLPyYjWNFO9UaQovQpG8rCxTqu2/5etswGMBmQNRlUcI=").AsSerializable<Neo.SmartContract.NefFile>();

    #endregion

    #region Safe methods

    /// <summary>
    /// Safe method
    /// </summary>
    [DisplayName("verify")]
    public abstract bool? Verify(UInt160? asset, byte[]? proof, byte[]? publicInputs, byte[]? merkleRoot, byte[]? nullifierHash, UInt160? recipient, UInt160? relayer, BigInteger? amount, BigInteger? fee);

    #endregion

    #region Unsafe methods

    #endregion
}
