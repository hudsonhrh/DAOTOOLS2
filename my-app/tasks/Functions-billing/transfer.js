const { VERIFICATION_BLOCK_CONFIRMATIONS, networkConfig } = require("../../network-config")
const utils = require("../utils")

task("functions-sub-transfer", "Request ownership of an Functions subscription be transferred to a new address")
  .addParam("subid", "Subscription ID")
  .addParam("newowner", "Address of the new owner")
  .setAction(async (taskArgs) => {
    if (network.name === "hardhat") {
      throw Error(
        'This command cannot be used on a local hardhat chain.  Please specify a valid network or simulate an FunctionsConsumer request locally with "npx hardhat functions-simulate".'
      )
    }

    utils.prompt(
      "\nTransferring the subscription to a new owner will require generating a new signature for encrypted secrets.\nAny previous encrypted secrets will no longer work with this subscription ID and must be regenerated by the new owner.\nDo you still want to continue? (y) Yes / (n) No\n"
    )

    const subscriptionId = taskArgs.subid
    const newOwner = taskArgs.newowner

    const RegistryFactory = await ethers.getContractFactory(
      "contracts/dev/functions/FunctionsBillingRegistry.sol:FunctionsBillingRegistry"
    )
    const registry = await RegistryFactory.attach(networkConfig[network.name]["functionsBillingRegistryProxy"])

    // Check that the subscription is valid
    let subInfo
    try {
      subInfo = await registry.getSubscription(subscriptionId)
    } catch (error) {
      if (error.errorName === "InvalidSubscription") {
        throw Error(`Subscription ID ${subscriptionId} is invalid or does not exist`)
      }
      throw error
    }

    // Check that the requesting wallet is the owner of the subscription
    const accounts = await ethers.getSigners()
    const signer = accounts[0]
    if (subInfo[1] !== signer.address) {
      throw Error("The current wallet is not the owner of the subscription")
    }

    console.log(`Requesting ownership transfer of subscription ${subscriptionId} to new owner ${newOwner}`)
    const transferTx = await registry.requestSubscriptionOwnerTransfer(subscriptionId, newOwner)

    console.log(
      `Waiting ${VERIFICATION_BLOCK_CONFIRMATIONS} blocks for transaction ${transferTx.hash} to be confirmed...`
    )
    await transferTx.wait(VERIFICATION_BLOCK_CONFIRMATIONS)

    console.log(
      `\nOwnership transfer to ${newOwner} requested for subscription ${subscriptionId}.  The new owner must now accept the transfer request.`
    )
  })
