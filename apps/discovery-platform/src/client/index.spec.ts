import assert from "assert";
import * as db from "../db";
import { MockPgInstanceSingleton } from "../db/index.spec";
import { CreateClient } from "./dto";
import { createClient, deleteClient, getClient, updateClient } from "./index";

const createMockClient = (params?: CreateClient): CreateClient => {
  return {
    id: params?.id ?? "client",
    payment: params?.payment ?? "premium",
    labels: params?.labels ?? ["eth"],
  };
};

describe("test quota functions", function () {
  let dbInstance: db.DBInstance;

  beforeAll(async function () {
    dbInstance = await MockPgInstanceSingleton.getDbInstance();
    MockPgInstanceSingleton.getInitialState();
  });

  beforeEach(async function () {
    MockPgInstanceSingleton.getInitialState().restore();
  });

  it("should create client", async function () {
    const mockClient = createMockClient();
    const client = await createClient(dbInstance, mockClient);
    assert.equal(client.id, mockClient.id);
  });
  it("should get client by id", async function () {
    const mockClient = createMockClient();
    const createdClient = await createClient(dbInstance, mockClient);
    await createClient(
      dbInstance,
      createMockClient({
        id: "other client",
        payment: "premium",
        labels: [],
      })
    );
    const queryClient = await getClient(dbInstance, createdClient.id);
    assert.equal(queryClient?.id, createdClient.id);
    assert.equal(queryClient?.payment, createdClient.payment);
  });
  it("should update client", async function () {
    const mockClient = createMockClient();
    const createdClient = await createClient(dbInstance, mockClient);
    await updateClient(dbInstance, {
      ...createdClient,
      labels: ["eth"],
    });
    const queryClient = await getClient(dbInstance, createdClient.id);
    assert.equal(queryClient?.id, mockClient.id);
    assert.deepEqual(queryClient?.labels, ["eth"]);
  });
  it("should delete client", async function () {
    const mockClient = createMockClient({
      id: "client",
      payment: "premium",
      labels: [],
    });
    const createdClient = await createClient(dbInstance, mockClient);
    if (!createdClient.id) throw new Error("Could not create mock client");
    await deleteClient(dbInstance, createdClient.id);
    const deletedClient = await getClient(dbInstance, createdClient.id);
    assert.equal(deletedClient, undefined);
  });
});
