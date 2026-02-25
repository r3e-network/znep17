using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using System.ComponentModel;
using System.Numerics;

namespace zNEP17.TestContracts;

[DisplayName("TestNep17Token")]
[SupportedStandards(NepStandard.Nep17)]
[ContractPermission(Permission.Any, Method.Any)]
public class TestNep17Token : Nep17Token
{
    public override string Symbol
    {
        [Safe]
        get => "TNEP17";
    }

    public override byte Decimals
    {
        [Safe]
        get => 0;
    }

    public static void MintForTesting(UInt160 to, BigInteger amount)
    {
        ExecutionEngine.Assert(to.IsValidAndNotZero);
        ExecutionEngine.Assert(amount > 0);
        Mint(to, amount);
    }

    [DisplayName("onNEP17Payment")]
    public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
    {
        // No-op for testing.
    }
}
