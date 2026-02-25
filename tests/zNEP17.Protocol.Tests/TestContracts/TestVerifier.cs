using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;
using System.ComponentModel;
using System.Numerics;

namespace zNEP17.TestContracts;

[DisplayName("TestVerifier")]
[ContractPermission(Permission.Any, Method.Any)]
public class TestVerifier : SmartContract
{
    private static readonly byte[] KeyOwner = new byte[] { 0x01 };
    private static readonly byte[] KeyResult = new byte[] { 0x02 };

    public static void _deploy(object data, bool update)
    {
        if (update)
            return;

        Storage.Put(KeyOwner, (byte[])Runtime.Transaction.Sender);
        Storage.Put(KeyResult, 1);
    }

    public static void SetResult(bool result)
    {
        UInt160 owner = (UInt160)(byte[])Storage.Get(KeyOwner)!;
        ExecutionEngine.Assert(owner.IsValidAndNotZero);
        ExecutionEngine.Assert(Runtime.CheckWitness(owner));

        Storage.Put(KeyResult, result ? 1 : 0);
    }

    [Safe]
    public static bool GetResult()
    {
        ByteString? value = Storage.Get(KeyResult);
        return value is null || (BigInteger)value != 0;
    }

    [Safe]
    public static bool Verify(
        UInt160 asset,
        byte[] proof,
        byte[] publicInputs,
        byte[] merkleRoot,
        byte[] nullifierHash,
        
        UInt160 recipient,
        UInt160 relayer,
        BigInteger amount,
        BigInteger fee)
    {
        if (!GetResult())
            return false;

        if (!asset.IsValidAndNotZero || !recipient.IsValidAndNotZero || !relayer.IsValidAndNotZero)
            return false;
        if (proof is null || proof.Length == 0 || proof[0] != 0x01)
            return false;
        if (publicInputs is null || publicInputs.Length == 0)
            return false;
        if (merkleRoot is null || merkleRoot.Length != 32)
            return false;
        if (nullifierHash is null || nullifierHash.Length != 32)
            return false;
        if (amount <= 0 || fee < 0 || amount <= fee)
            return false;

        return true;
    }
}
