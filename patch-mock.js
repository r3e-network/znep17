const fs = require('fs');

let code = fs.readFileSync('tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs', 'utf8');

code = code.replace(
`            BigInteger? amount,
            BigInteger? fee);
    }`,
`            BigInteger? amount,
            BigInteger? fee);

        [DisplayName("verifyTreeUpdate")]
        public abstract bool? VerifyTreeUpdate(
            byte[]? proof,
            byte[]? publicInputs,
            byte[]? oldRoot,
            byte[]? newRoot,
            byte[]? oldLeaf,
            byte[]? newLeaf,
            BigInteger? leafIndex);
    }`
);

code = code.replace(/BuildSingleMethodManifest\([\s\S]*?\)\)/m, `BuildVerifierManifest()`);

code = code.replace(/private static ContractManifest BuildSingleMethodManifest\([\s\S]*?return manifest;\s*}/m, 
`    private static ContractManifest BuildVerifierManifest()
    {
        ContractManifest manifest = ContractManifest.Parse(Neo.SmartContract.Testing.zNEP17Protocol.Manifest.ToJson().ToString());
        manifest.Abi.Events = Array.Empty<ContractEventDescriptor>();
        manifest.Abi.Methods =
        [
            new ContractMethodDescriptor
            {
                Name = "verify",
                Safe = true,
                ReturnType = ContractParameterType.Boolean,
                Parameters = new[]
                {
                    new ContractParameterDefinition { Name = "asset", Type = ContractParameterType.Hash160 },
                    new ContractParameterDefinition { Name = "proof", Type = ContractParameterType.ByteArray },
                    new ContractParameterDefinition { Name = "publicInputs", Type = ContractParameterType.ByteArray },
                    new ContractParameterDefinition { Name = "merkleRoot", Type = ContractParameterType.ByteArray },
                    new ContractParameterDefinition { Name = "nullifierHash", Type = ContractParameterType.ByteArray },
                    new ContractParameterDefinition { Name = "commitment", Type = ContractParameterType.ByteArray },
                    new ContractParameterDefinition { Name = "recipient", Type = ContractParameterType.Hash160 },
                    new ContractParameterDefinition { Name = "relayer", Type = ContractParameterType.Hash160 },
                    new ContractParameterDefinition { Name = "amount", Type = ContractParameterType.Integer },
                    new ContractParameterDefinition { Name = "fee", Type = ContractParameterType.Integer }
                }
            },
            new ContractMethodDescriptor
            {
                Name = "verifyTreeUpdate",
                Safe = true,
                ReturnType = ContractParameterType.Boolean,
                Parameters = new[]
                {
                    new ContractParameterDefinition { Name = "proof", Type = ContractParameterType.ByteArray },
                    new ContractParameterDefinition { Name = "publicInputs", Type = ContractParameterType.ByteArray },
                    new ContractParameterDefinition { Name = "oldRoot", Type = ContractParameterType.ByteArray },
                    new ContractParameterDefinition { Name = "newRoot", Type = ContractParameterType.ByteArray },
                    new ContractParameterDefinition { Name = "oldLeaf", Type = ContractParameterType.ByteArray },
                    new ContractParameterDefinition { Name = "newLeaf", Type = ContractParameterType.ByteArray },
                    new ContractParameterDefinition { Name = "leafIndex", Type = ContractParameterType.Integer }
                }
            }
        ];
        manifest.Name = $"zNEP17.Verifier.mock.{Interlocked.Increment(ref _mockContractSequence)}";
        return manifest;
    }`);

code = code.replace(
`                        (_, proof, _, _, _, _, _, _, _, _)  => verifyRule(proof));
            });`,
`                        (_, proof, _, _, _, _, _, _, _, _)  => verifyRule(proof));
                mock.Setup(m => m.VerifyTreeUpdate(
                        It.IsAny<byte[]?>(),
                        It.IsAny<byte[]?>(),
                        It.IsAny<byte[]?>(),
                        It.IsAny<byte[]?>(),
                        It.IsAny<byte[]?>(),
                        It.IsAny<byte[]?>(),
                        It.IsAny<BigInteger?>()
                    ))
                    .Returns(true);
            });`
);

fs.writeFileSync('tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs', code);
