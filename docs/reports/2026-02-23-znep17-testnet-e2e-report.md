# zNEP17 Testnet E2E Acceptance Report

- Generated: 2026-02-23T12:31:30.135Z
- Source Report: `artifacts/testnet-e2e-2026-02-23T12-27-38_712Z.json`
- RPC: `http://seed1t5.neo.org:20332`
- Network Magic: `894710606`
- Start (UTC): `2026-02-23T12:24:44.891Z`
- End (UTC): `2026-02-23T12:27:38.712Z`
- Success: `true`

## Accounts

| Role | Address | ScriptHash |
|---|---|---|
| funder | `NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu` | `69aa227309f35d7196d0d9f97fc22b33613a31eb` |
| owner | `NPv8uZ3xSvfH93qkDJHd2qhCWRDzaP3EcY` | `4005da24f997df6bc53a47aaa58324e8159ee82b` |
| altOwner | `NdoEdXCMxehuBouCyxk7ridVUwsCCPFySk` | `7702da818403dd89d3d0327a7c89303d9c3e2cc4` |

## Deployed Contracts

| Alias | Name | Hash | Checksum |
|---|---|---|---|
| token | TestNep17Token | `732bdf780003a705054b0cd77da9a4376a371635` | `2226581547` |
| verifier | TestVerifier | `8d5b7a87a3894473c25eb36f36eede01f17ab339` | `39530439` |
| vaultMain | zNEP17Protocol | `c1dfe49dbeb1e0b20a3bf0d9c3b448001548b03d` | `3621312295` |
| vaultNoVerifier | zNEP17Protocol | `136a2162c88916b1e92a0d33bf011d01d6f8b923` | `3621312295` |

## Scenario Matrix

| Scenario | Pass |
|---|---|
| success_path | YES |
| verifier_rejects_keeps_state | YES |
| unknown_root_rejected | YES |
| fee_ge_amount_rejected | YES |
| nullifier_replay_rejected | YES |
| missing_verifier_rejected | YES |

## Transaction Summary

- Total tx: **28**
- HALT: **23**
- FAULT (expected failure-path assertions): **5**

## Assertion Results

| Assertion | Expected | Actual | Pass |
|---|---|---|---|
| funder_has_gas | `> 120` | `40250.74754241` | YES |
| owner_has_gas | `> 80` | `120` | YES |
| vault_withdraw_verifier_false_s2_exception_contains | `zk proof invalid` | `ABORTMSG is executed. Reason: zk proof invalid` | YES |
| vault_withdraw_unknown_root_s3_exception_contains | `unknown merkle root` | `ABORTMSG is executed. Reason: unknown merkle root` | YES |
| vault_withdraw_fee_ge_amount_s4_exception_contains | `invalid withdraw arguments` | `ABORTMSG is executed. Reason: invalid withdraw arguments` | YES |
| vault_withdraw_replay_s5_exception_contains | `nullifier already used` | `ABORTMSG is executed. Reason: nullifier already used` | YES |
| vault_no_verifier_withdraw_fail_s6_exception_contains | `zk proof invalid` | `ABORTMSG is executed. Reason: zk proof invalid` | YES |
| main_vault_escrow_matches_token_balance | `0` | `0` | YES |
| no_verifier_vault_escrow_matches_token_balance | `10` | `10` | YES |
| owner_gas_balance_end | `> 0` | `39.83254667` | YES |

## Full Transaction List

| # | Label | TxID | VMState | Gas Consumed | Exception |
|---|---|---|---|---|---|
| 1 | fund_owner_gas | `0x19a80769d10cf1e5fd5d3baec57035d0e73510f93b7371ffae690b7795d926ea` | `HALT` | `215926` |  |
| 2 | token_deploy | `0x2e73d1a915972147f2ed02d4f35efa9473effd50b5046c29d1756829ab1c57b9` | `HALT` | `1000035859` |  |
| 3 | verifier_deploy | `0x175040cac310dc98975a2b49c1a805ad691b7ac64a9749cedbd33ee8bf6cc0e3` | `HALT` | `1000149153` |  |
| 4 | vaultMain_deploy | `0x931bd40e772e58029997cb0a2dcbf44eea6bed53050f1a8124afe8daf56b9f18` | `HALT` | `1000164561` |  |
| 5 | vault_set_verifier_main | `0x75a065c39cbe50739c8346f1857c2a72114fd82fa65d9155f9ee5bef30545b28` | `HALT` | `182328` |  |
| 6 | token_mint_owner_initial | `0xa1b47d6d3eb2074f9546b21cdfb6ea537ab686ba4b1c09685b9f56ada7274e2c` | `HALT` | `314819` |  |
| 7 | verifier_set_true_s1 | `0x5659dad986948a73f5d3e435fb6c781b683968526f0935035f2801c6ffcb4dec` | `HALT` | `135911` |  |
| 8 | vault_deposit_s1 | `0x12640c10bdfdbf18f4f62a5d84b2ac49fe6643ed13d3793020d23914203926de` | `HALT` | `1278487` |  |
| 9 | vault_withdraw_success_s1 | `0x6db48b47fa1f7cd90058f4a14fb46f73d01587853dbc253d47e8dcb06777069c` | `HALT` | `1506890` |  |
| 10 | verifier_set_false_s2 | `0xea1440e7890be8e2f37cd20713b63b0c3adc7d7b4770295cdaee31669924451e` | `HALT` | `134909` |  |
| 11 | vault_deposit_s2 | `0x78921c9715c923bff9ec63d4d7531297c57570497db9aca0719f65e126e36d83` | `HALT` | `1262422` |  |
| 12 | vault_withdraw_verifier_false_s2 | `0x56c2a1a05fdb186e9bd45cf73a81a8a9a8ccc9911edada38074698de661a306d` | `FAULT` | `428607` | ABORTMSG is executed. Reason: zk proof invalid |
| 13 | verifier_set_true_s2_cleanup | `0xeb3152fa11dd63c9b6992e377d9d09939558bb09e32245e36ae7a552e20516f3` | `HALT` | `135911` |  |
| 14 | vault_withdraw_cleanup_s2 | `0xdb8101f0750a6222facac82d669cd070c38879b0394f2d27cc840faa297fadaa` | `HALT` | `1506890` |  |
| 15 | vault_deposit_s3 | `0x9a444182d00d14489b0169b4f63a9a9837c5abd5b4f777621089e367db602766` | `HALT` | `1262422` |  |
| 16 | vault_withdraw_unknown_root_s3 | `0xe2897f69b90666c65c10c652b7913e9c4ad0c1c57562a66ea83cfdd558a4f920` | `FAULT` | `236606` | ABORTMSG is executed. Reason: unknown merkle root |
| 17 | vault_withdraw_cleanup_s3 | `0x9e586c91f1886094e57332732dbb366ea07c21f6766b92ed186ef56d48b97c80` | `HALT` | `1506890` |  |
| 18 | vault_deposit_s4 | `0x41aaadf446ad76bf69bb967149bfbb8bfefda50998986918dfac9454f1004ecd` | `HALT` | `1262422` |  |
| 19 | vault_withdraw_fee_ge_amount_s4 | `0x51bfeee1c406a2db3593e95d2d1b6dff6c5afd75023d944b315d60818b009205` | `FAULT` | `187735` | ABORTMSG is executed. Reason: invalid withdraw arguments |
| 20 | vault_withdraw_cleanup_s4 | `0x9617aceed8324b480116caa59a4fd01934d80e771f18aca8111394cebd8ed1b5` | `HALT` | `1506890` |  |
| 21 | vault_deposit_s5 | `0x74eb86ec44b25e09581a15c74debb665768189af54c80fb5f69514cc92260198` | `HALT` | `1262422` |  |
| 22 | vault_withdraw_first_s5 | `0xeb079644c5665734103b7601870fb2570856ac0e95d2f4e87e85e46128de9105` | `HALT` | `1506890` |  |
| 23 | vault_withdraw_replay_s5 | `0x407d09c905533079076e8f3baad9afab411a7c931cdf02462ebd89ee904e05dc` | `FAULT` | `285221` | ABORTMSG is executed. Reason: nullifier already used |
| 24 | fund_alt_owner_gas_s6 | `0x6ddf9cbba0d338edb32cc680bf1e5bdea6ab30a98853dd301d6e39720b862382` | `HALT` | `215926` |  |
| 25 | vaultNoVerifier_deploy | `0xa89045b9227e26e4d4d3eaa89189713d9ed8c5e111bb41c17c19cf1c0a0e073e` | `HALT` | `1000164561` |  |
| 26 | token_mint_alt_owner_s6 | `0x2957cfffcf09236380e6bcf46838fdaafe43cfa117b738caac8eb9ce6b27795f` | `HALT` | `311815` |  |
| 27 | vault_no_verifier_deposit_s6 | `0xef0691ebb87f0127912822c4cb0dd3fff2b6ff42ca17b81f6dc0db98c3cf3a93` | `HALT` | `1278487` |  |
| 28 | vault_no_verifier_withdraw_fail_s6 | `0x098ae6e96a006a1c8249c6f7066222eed5ffa3ff99545e78aac4dd8914633f62` | `FAULT` | `319236` | ABORTMSG is executed. Reason: zk proof invalid |

## Notes

- All 6 designed scenarios passed on Neo N3 testnet.
- FAULT transactions are intentional negative-path checks and are validated by exception-message assertions.