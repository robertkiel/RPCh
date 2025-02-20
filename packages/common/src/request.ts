import PeerId from "peer-id";
import { utils } from "ethers";
import type {
  Envelope,
  box_request,
  unbox_request,
  Session,
  Identity,
} from "@rpch/crypto-bridge/nodejs";
import Message from "./message";
import {
  generatePseudoRandomId,
  joinPartsToBody,
  splitBodyToParts,
} from "./utils";

/**
 * Represents a request made by the RPCh.
 * To be send over the HOPR network via Request.toMessage().
 */
export default class Request {
  private constructor(
    public readonly id: number,
    public readonly provider: string,
    public readonly body: string,
    public readonly entryNodeDestination: string,
    public readonly exitNodeDestination: string,
    public readonly exitNodeIdentity: Identity,
    public readonly session: Session
  ) {}

  /**
   * Create a new Request
   * @param provider
   * @param body
   * @param entryNode
   * @param exitNode
   * @returns Request
   */
  public static createRequest(
    crypto: {
      Envelope: typeof Envelope;
      box_request: typeof box_request;
    },
    provider: string,
    body: string,
    entryNodeDestination: string,
    exitNodeDestination: string,
    exitNodeReadIdentity: Identity
  ): Request {
    const id = generatePseudoRandomId(1e6);
    const payload = joinPartsToBody(["request", provider, body]);
    const envelope = new crypto.Envelope(
      utils.toUtf8Bytes(payload),
      entryNodeDestination,
      exitNodeDestination
    );
    const session = crypto.box_request(envelope, exitNodeReadIdentity);

    return new Request(
      id,
      provider,
      body,
      entryNodeDestination,
      exitNodeDestination,
      exitNodeReadIdentity,
      session
    );
  }

  /**
   * Recreate a Request from an incoming Message
   * @param message
   * @param exitNode
   * @returns Request
   */
  public static fromMessage(
    crypto: {
      Envelope: typeof Envelope;
      unbox_request: typeof unbox_request;
    },
    message: Message,
    exitNodeDestination: string,
    exitNodeWriteIdentity: Identity,
    lastRequestFromClient: bigint,
    updateLastRequestFromClient: (clientId: string, counter: bigint) => any
  ): Request {
    const [origin, encrypted] = splitBodyToParts(message.body);

    const entryNodeDestination =
      PeerId.createFromB58String(origin).toB58String();

    const session = crypto.unbox_request(
      new crypto.Envelope(
        utils.arrayify(encrypted),
        entryNodeDestination,
        exitNodeDestination
      ),
      exitNodeWriteIdentity,
      lastRequestFromClient
    );

    updateLastRequestFromClient(
      entryNodeDestination,
      session.updated_counter()
    );

    const [type, provider, ...remaining] = splitBodyToParts(
      utils.toUtf8String(session.get_request_data())
    );

    if (type !== "request") throw Error("Message is not a Request");
    return new Request(
      message.id,
      provider,
      joinPartsToBody(remaining),
      entryNodeDestination,
      exitNodeDestination,
      exitNodeWriteIdentity,
      session
    );
  }

  /**
   * Convert Request to a Message
   * @returns Message
   */
  public toMessage(): Message {
    const message = new Message(
      this.id,
      joinPartsToBody([
        this.entryNodeDestination,
        utils.hexlify(this.session.get_request_data()),
      ])
    );

    return message;
  }
}
