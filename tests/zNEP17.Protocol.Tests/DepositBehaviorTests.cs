using System.Numerics;
using Xunit;
using zNEP17.Protocol;

namespace zNEP17.Protocol.Tests;

public class DepositBehaviorTests
{
    [Fact]
    public void DepositValidation_Rejects_NonPositiveAmount()
    {
        bool validZero = PrivacyGuards.IsValidDepositRequest(
            isAssetValid: true,
            isStealthAddressValid: true,
            amount: BigInteger.Zero,
            leafLength: PrivacyGuards.LeafLength);

        bool validNegative = PrivacyGuards.IsValidDepositRequest(
            isAssetValid: true,
            isStealthAddressValid: true,
            amount: -1,
            leafLength: PrivacyGuards.LeafLength);

        Assert.False(validZero);
        Assert.False(validNegative);
    }

    [Fact]
    public void DepositValidation_Rejects_WrongLeafLength()
    {
        bool valid = PrivacyGuards.IsValidDepositRequest(
            isAssetValid: true,
            isStealthAddressValid: true,
            amount: 1,
            leafLength: 16);

        Assert.False(valid);
    }

    [Fact]
    public void DepositValidation_Accepts_WellFormedRequest()
    {
        bool valid = PrivacyGuards.IsValidDepositRequest(
            isAssetValid: true,
            isStealthAddressValid: true,
            amount: 100,
            leafLength: PrivacyGuards.LeafLength);

        Assert.True(valid);
    }
}
