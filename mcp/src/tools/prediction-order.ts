import { SyeniteError } from "../errors.js";
import { getOrderBook } from "../data/polymarket.js";

export const predictionOrderDescription = `Prepare a Polymarket CLOB order for signing.
IMPORTANT: Polymarket CLOB uses off-chain EIP-712 order signing with on-chain settlement, NOT direct
on-chain transactions. This tool returns the EIP-712 typed-data payload the agent must sign with its
Polygon EOA and POST to https://clob.polymarket.com/order. It is NOT compatible with tx.simulate /
tx.verify because there is no on-chain transaction until settlement.

Inputs: tokenId, side (buy/sell), size (shares), price (0-1), expiration (unix seconds, 0 = GTC).
Returns the domain, types, message, and the signing/submission instructions. See docs/internal/planning/v0.6-trackC-spike.md.`;

const CTF_EXCHANGE_ADDRESS =
  process.env.POLYMARKET_EXCHANGE_ADDRESS ?? "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
const POLYGON_CHAIN_ID = 137;
const USDC_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

function generateSalt(): string {
  return Date.now().toString() + Math.floor(Math.random() * 1_000_000).toString();
}

interface OrderParams {
  tokenId: string;
  side: "buy" | "sell";
  size: number;
  price: number;
  maker: string;
  taker?: string;
  expiration?: number;
  feeRateBps?: number;
}

function buildOrderMessage(p: OrderParams): Record<string, string | number> {
  const sizeShares = Math.floor(p.size * 1_000_000); // 6 decimals
  const priceMicros = Math.floor(p.price * 1_000_000);
  const makerAmount = p.side === "buy"
    ? sizeShares * priceMicros / 1_000_000
    : sizeShares;
  const takerAmount = p.side === "buy"
    ? sizeShares
    : sizeShares * priceMicros / 1_000_000;

  return {
    salt: generateSalt(),
    maker: p.maker,
    signer: p.maker,
    taker: p.taker ?? "0x0000000000000000000000000000000000000000",
    tokenId: p.tokenId,
    makerAmount: Math.floor(makerAmount).toString(),
    takerAmount: Math.floor(takerAmount).toString(),
    expiration: String(p.expiration ?? 0),
    nonce: "0",
    feeRateBps: String(p.feeRateBps ?? 0),
    side: p.side === "buy" ? 0 : 1,
    signatureType: 0,
  };
}

function validateInputs(params: OrderParams): void {
  if (!params.tokenId) throw SyeniteError.invalidInput("tokenId is required.");
  if (!["buy", "sell"].includes(params.side)) {
    throw SyeniteError.invalidInput("side must be 'buy' or 'sell'.");
  }
  if (!(params.size > 0)) throw SyeniteError.invalidInput("size must be positive.");
  if (!(params.price > 0 && params.price < 1)) {
    throw SyeniteError.invalidInput("price must be between 0 and 1 exclusive (USDC per share).");
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(params.maker)) {
    throw SyeniteError.invalidInput("maker must be a valid EVM address.");
  }
}

export async function handlePredictionOrder(params: {
  tokenId: string;
  side: "buy" | "sell";
  outcome: "YES" | "NO";
  size: number;
  price: number;
  maker: string;
  expiration?: number;
}): Promise<Record<string, unknown>> {
  const orderParams: OrderParams = {
    tokenId: params.tokenId,
    side: params.side,
    size: params.size,
    price: params.price,
    maker: params.maker,
    expiration: params.expiration,
  };
  validateInputs(orderParams);

  const book = await getOrderBook(params.tokenId);
  const midPrice = book?.midPrice ?? 0;

  const message = buildOrderMessage(orderParams);

  const domain = {
    name: "Polymarket CTF Exchange",
    version: "1",
    chainId: POLYGON_CHAIN_ID,
    verifyingContract: CTF_EXCHANGE_ADDRESS,
  };

  const types = {
    Order: [
      { name: "salt", type: "uint256" },
      { name: "maker", type: "address" },
      { name: "signer", type: "address" },
      { name: "taker", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "makerAmount", type: "uint256" },
      { name: "takerAmount", type: "uint256" },
      { name: "expiration", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "feeRateBps", type: "uint256" },
      { name: "side", type: "uint8" },
      { name: "signatureType", type: "uint8" },
    ],
  };

  return {
    source: "Polymarket CLOB",
    mode: "eip712_offchain_order",
    notice:
      "Polymarket CLOB does NOT accept direct on-chain order placement. This payload must be EIP-712 signed " +
      "by the maker's Polygon EOA and POSTed to https://clob.polymarket.com/order. It is NOT compatible with " +
      "tx.simulate / tx.verify / tx.receipt because no transaction is broadcast until settlement.",
    order: {
      tokenId: params.tokenId,
      outcome: params.outcome,
      side: params.side,
      size: params.size,
      price: params.price,
      midPriceAtQuote: round(midPrice, 4),
      maker: params.maker,
      expiration: params.expiration ?? 0,
      chainId: POLYGON_CHAIN_ID,
      verifyingContract: CTF_EXCHANGE_ADDRESS,
    },
    typedData: {
      domain,
      types,
      primaryType: "Order",
      message,
    },
    submission: {
      endpoint: "https://clob.polymarket.com/order",
      method: "POST",
      body: {
        order: "<signed EIP-712 order with signature field>",
        owner: params.maker,
        orderType: "GTC",
      },
      authHeaders: [
        "POLY_ADDRESS: <maker address>",
        "POLY_SIGNATURE: <L1 auth signature>",
        "POLY_TIMESTAMP: <unix seconds>",
        "POLY_NONCE: <nonce>",
        "POLY_API_KEY: <API key>",
      ],
      docs: "https://docs.polymarket.com/",
    },
    approvalRequired: {
      note:
        "Before first order: approve the CTF Exchange to spend USDC and outcome tokens. Standard ERC-20 " +
        "approve on USDC is an on-chain tx — compatible with tx.verify/simulate/receipt.",
      tokenAddress: USDC_POLYGON,
      spender: CTF_EXCHANGE_ADDRESS,
      amount: "max",
      chainId: POLYGON_CHAIN_ID,
    },
    timestamp: new Date().toISOString(),
  };
}
