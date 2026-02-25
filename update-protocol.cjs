const fs = require('fs');

const path = 'src/zNEP17.Protocol/zNEP17Protocol.cs';
let content = fs.readFileSync(path, 'utf8');

// Remove commitment references
content = content.replace(/,\s*byte\[\] commitment/g, '');
content = content.replace(/,\s*commitment/g, '');
content = content.replace(/int commitmentLength = commitment is null \? 0 : commitment\.Length;\s*/g, '');
content = content.replace(/commitmentLength,\s*/g, '');
content = content.replace(/ && commitment is not null/g, '');
content = content.replace(/ExecutionEngine\.Assert\(!IsCommitmentSpent\(commitment!\), "commitment already spent"\);\s*/g, '');
content = content.replace(/UInt160 noteAsset = GetCommitmentAsset\(commitment!\);\s*/g, '');
content = content.replace(/BigInteger noteAmount = GetCommitmentAmount\(commitment!\);\s*/g, '');
content = content.replace(/BigInteger noteIndex = GetCommitmentIndex\(commitment!\);\s*/g, '');
content = content.replace(/ExecutionEngine\.Assert\(noteAsset\.IsValidAndNotZero, "unknown commitment"\);\s*/g, '');
content = content.replace(/ExecutionEngine\.Assert\(noteAsset == asset, "commitment asset mismatch"\);\s*/g, '');
content = content.replace(/ExecutionEngine\.Assert\(noteAmount == amount, "commitment amount mismatch"\);\s*/g, '');
content = content.replace(/ExecutionEngine\.Assert\(noteIndex >= 0, "unknown commitment index"\);\s*/g, '');
content = content.replace(/BigInteger rootLeafCount = GetRootLeafCount\(merkleRoot!\);\s*/g, '');
content = content.replace(/ExecutionEngine\.Assert\(rootLeafCount > noteIndex, "root predates commitment"\);\s*/g, '');
content = content.replace(/SpentCommitmentMap\(\)\.Put\(commitment!, true\);\s*/g, '');
content = content.replace(/CommitmentAssetMap\(\)\.Put\(leaf!, \(byte\[\]\)asset\);\s*/g, '');
content = content.replace(/CommitmentAmountMap\(\)\.Put\(leaf!, amount\);\s*/g, '');
content = content.replace(/CommitmentIndexMap\(\)\.Put\(leaf!, index\);\s*/g, '');
content = content.replace(/CommitmentDepositorMap\(\)\.Put\(leaf!, \(byte\[\]\)from\);\s*/g, '');

// Also need to remove the whole EmergencyWithdraw feature since it relies on commitment.
// Finding the methods:
content = content.replace(/public delegate void EmergencyWithdrawEnabledDelegate\(BigInteger availableAt\);\s*/g, '');
content = content.replace(/public delegate void EmergencyWithdrawExecutedDelegate\(UInt160 asset, UInt160 recipient, BigInteger amount, byte\[\] commitment\);\s*/g, '');
content = content.replace(/public delegate void EmergencyWithdrawDisabledDelegate\(\);\s*/g, '');

content = content.replace(/\[DisplayName\("EmergencyWithdrawEnabled"\)\]\s*public static event EmergencyWithdrawEnabledDelegate OnEmergencyWithdrawEnabled = null!;\s*/g, '');
content = content.replace(/\[DisplayName\("EmergencyWithdrawExecuted"\)\]\s*public static event EmergencyWithdrawExecutedDelegate OnEmergencyWithdrawExecuted = null!;\s*/g, '');
content = content.replace(/\[DisplayName\("EmergencyWithdrawDisabled"\)\]\s*public static event EmergencyWithdrawDisabledDelegate OnEmergencyWithdrawDisabled = null!;\s*/g, '');

content = content.replace(/private static readonly byte\[\] KeyEmergencyWithdrawAvailableAt = new byte\[\] \{ 0x1D \};\s*/g, '');

content = content.replace(/Storage\.Delete\(KeyEmergencyWithdrawAvailableAt\);\s*OnEmergencyWithdrawDisabled\(\);\s*/g, '');

// Find EnableEmergencyWithdraw, DisableEmergencyWithdraw, EmergencyWithdraw, and delete them
content = content.replace(/\/\/\/ <summary>[\s\S]*?public static void EnableEmergencyWithdraw\(\)[\s\S]*?\}\s*\/\/\/ <summary>[\s\S]*?public static void EmergencyWithdraw\([\s\S]*?\}\s*(?=private static void AssertOwnerWitness)/, '');

// Remove maps
content = content.replace(/private static StorageMap CommitmentAssetMap\(\) => new\(Storage\.CurrentContext, PrefixCommitmentAssets\);\s*/g, '');
content = content.replace(/private static StorageMap CommitmentAmountMap\(\) => new\(Storage\.CurrentContext, PrefixCommitmentAmounts\);\s*/g, '');
content = content.replace(/private static StorageMap SpentCommitmentMap\(\) => new\(Storage\.CurrentContext, PrefixSpentCommitments\);\s*/g, '');
content = content.replace(/private static StorageMap CommitmentIndexMap\(\) => new\(Storage\.CurrentContext, PrefixCommitmentIndexes\);\s*/g, '');
content = content.replace(/private static StorageMap CommitmentDepositorMap\(\) => new\(Storage\.CurrentContext, PrefixCommitmentDepositors\);\s*/g, '');

content = content.replace(/private const byte PrefixCommitmentAssets = 0x06;\s*/g, '');
content = content.replace(/private const byte PrefixCommitmentAmounts = 0x07;\s*/g, '');
content = content.replace(/private const byte PrefixSpentCommitments = 0x08;\s*/g, '');
content = content.replace(/private const byte PrefixCommitmentIndexes = 0x0A;\s*/g, '');
content = content.replace(/private const byte PrefixCommitmentDepositors = 0x0C;\s*/g, '');

// Also remove the safe access methods
content = content.replace(/\[Safe\]\s*public static UInt160 GetCommitmentAsset\(byte\[\] commitment\)\s*\{[\s\S]*?\}\s*/g, '');
content = content.replace(/\[Safe\]\s*public static BigInteger GetCommitmentAmount\(byte\[\] commitment\)\s*\{[\s\S]*?\}\s*/g, '');
content = content.replace(/\[Safe\]\s*public static BigInteger GetCommitmentIndex\(byte\[\] commitment\)\s*\{[\s\S]*?\}\s*/g, '');
content = content.replace(/\[Safe\]\s*public static UInt160 GetCommitmentDepositor\(byte\[\] commitment\)\s*\{[\s\S]*?\}\s*/g, '');
content = content.replace(/\[Safe\]\s*public static bool IsCommitmentSpent\(byte\[\] commitment\)\s*\{[\s\S]*?\}\s*/g, '');
content = content.replace(/\[Safe\]\s*public static BigInteger GetEmergencyWithdrawAvailableAt\(\)\s*\{[\s\S]*?\}\s*/g, '');

// EmergencyWithdraw
content = content.replace(/public static void EnableEmergencyWithdraw\(\)\s*\{[\s\S]*?\}\s*/g, '');
content = content.replace(/public static void DisableEmergencyWithdraw\(\)\s*\{[\s\S]*?\}\s*/g, '');
content = content.replace(/\[NoReentrant\]\s*public static void EmergencyWithdraw\([\s\S]*?\}\s*/g, '');


fs.writeFileSync(path, content);
