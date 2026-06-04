import fs from "node:fs";

const root = "E:/github/ECAS_RTA_S32K324GHS_Heating";
const xdmPath = `${root}/BasicSoftware/integration/mcal/MCAL_Cfg/config/Can_43_FLEXCAN.xdm`;
const mcuPath = `${root}/BasicSoftware/integration/mcal/MCAL_Cfg/config/Mcu.xdm`;
const portPath = `${root}/BasicSoftware/integration/mcal/MCAL_Cfg/config/Port.xdm`;
const flexPbPath = `${root}/BasicSoftware/integration/mcal/src/gen/src/FlexCAN_Ip_PBcfg.c`;
const canPbPath = `${root}/BasicSoftware/integration/mcal/src/gen/src/Can_43_FLEXCAN_PBcfg.c`;
const cfgPath = `${root}/BasicSoftware/integration/mcal/src/gen/include/Can_43_FLEXCAN_Cfg.h`;
const s32Path = `${root}/BasicSoftware/integration/mcal/src/modules/BaseNXP/header/S32K324_FLEXCAN.h`;

function read(p) {
  return fs.readFileSync(p, "utf8");
}

function block(text, startRe, nextRe) {
  const s = text.search(startRe);
  if (s < 0) return "";
  const rest = text.slice(s);
  const n = rest.slice(1).search(nextRe);
  return n < 0 ? rest : rest.slice(0, n + 1);
}

function val(blockText, name) {
  const re = new RegExp(`<d:(?:var|ref)\\s+name="${name}"[^>]*>`, "m");
  const m = blockText.match(re);
  if (!m) return "";
  return m[0].match(/value="([^"]*)"/)?.[1] ?? "";
}

function enabled(blockText, name) {
  const re = new RegExp(`<d:ctr\\s+name="${name}"[\\s\\S]*?<a:a\\s+name="ENABLE"\\s+value="([^"]*)"`, "m");
  const m = blockText.match(re);
  return m ? m[1] : "";
}

function ctrBlocks(text, namePrefix) {
  const starts = [...text.matchAll(new RegExp(`<d:ctr\\s+name="${namePrefix}([^"]*)"`, "g"))];
  return starts.map((m, idx) => {
    const start = m.index;
    const end = idx + 1 < starts.length ? starts[idx + 1].index : text.length;
    return { name: `${namePrefix}${m[1]}`, text: text.slice(start, end) };
  });
}

const xdm = read(xdmPath);
const mcu = read(mcuPath);
const port = read(portPath);
const flexPb = read(flexPbPath);
const canPb = read(canPbPath);
const cfg = read(cfgPath);
const s32 = read(s32Path);

const controllerBlocks = ctrBlocks(xdm, "CanController_").filter((b) => /^CanController_\d+$/.test(b.name));
const controllers = controllerBlocks.map(({ name, text }) => {
  const fdBlock = block(text, /<d:ctr name="CanControllerFdBaudrateConfig"/, /<\/d:ctr>\s*<\/d:ctr>|<d:ctr name="CanTTController"/);
  return {
    name,
    id: val(text, "CanControllerId"),
    hwChannel: val(text, "CanHwChannel"),
    activation: val(text, "CanControllerActivation"),
    rxProcessing: val(text, "CanRxProcessing"),
    txProcessing: val(text, "CanTxProcessing"),
    busoffProcessing: val(text, "CanBusoffProcessing"),
    wakeupProcessing: val(text, "CanWakeupProcessing"),
    autoBusOffRecovery: val(text, "CanAutoBusOffRecovery"),
    loopBack: val(text, "CanLoopBackMode"),
    fdIso: val(text, "CanControllerFdISO"),
    clockRef: val(text, "CanCpuClockRef"),
    defaultBaudrate: val(text, "CanControllerDefaultBaudrate"),
    nominal: {
      rateKbps: val(text, "CanControllerBaudRate"),
      prescaler: val(text, "CanControllerPrescaller"),
      propSeg: val(text, "CanControllerPropSeg"),
      seg1: val(text, "CanControllerSeg1"),
      seg2: val(text, "CanControllerSeg2"),
      sjw: val(text, "CanControllerSyncJumpWidth"),
      busLengthM: val(text, "CanBusLength"),
      transceiverDelayNs: val(text, "CanPropDelayTranceiver"),
    },
    fd: {
      enabled: enabled(text, "CanControllerFdBaudrateConfig"),
      rateKbps: val(fdBlock, "CanControllerFdBaudRate"),
      prescaler: val(fdBlock, "CanControllerFdPrescaller"),
      propSeg: val(fdBlock, "CanControllerPropSeg"),
      seg1: val(fdBlock, "CanControllerSeg1"),
      seg2: val(fdBlock, "CanControllerSeg2"),
      sjw: val(fdBlock, "CanControllerSyncJumpWidth"),
      sspOffset: val(fdBlock, "CanControllerSspOffset"),
      brs: val(fdBlock, "CanControllerTxBitRateSwitch"),
    },
  };
});

const hohBlocks = [...xdm.matchAll(/<d:ctr\s+name="([^"]+)"\s+type="IDENTIFIABLE">([\s\S]*?)(?=<d:ctr\s+name="[^"]+"\s+type="IDENTIFIABLE">|<d:ctr name="CanMainFunctionRWPeriods"|<d:var name="CanEnableDualClockMode")/g)]
  .map((m) => ({ name: m[1], text: m[2] }))
  .filter((b) => b.text.includes("CanObjectType") && b.text.includes("CanControllerRef"));

const hohs = hohBlocks.map(({ name, text }) => {
  const controllerRef = val(text, "CanControllerRef");
  const controller = controllerRef.match(/CanController_(\d+)/)?.[1] ?? "";
  const filters = [...text.matchAll(/<d:ctr\s+name="([^"]+)"[\s\S]*?<d:var name="CanHwFilterCode"[^>]*value="([^"]*)"[\s\S]*?<d:var name="CanHwFilterMask"[^>]*value="([^"]*)"/g)]
    .map((m) => ({ name: m[1], code: m[2], mask: m[3] }));
  return {
    name,
    controller,
    objectId: val(text, "CanObjectId"),
    type: val(text, "CanObjectType"),
    idType: val(text, "CanIdType") || val(text, "CanHwObjectIdType"),
    handleType: val(text, "CanHandleType"),
    payload: val(text, "CanObjectPayloadLength"),
    polling: val(text, "CanHardwareObjectUsesPolling"),
    count: val(text, "CanHwObjectCount"),
    ramBlock: val(text, "CanHwObjectUsesBlock"),
    padding: val(text, "CanFdPaddingValue"),
    filters,
  };
});

const clockRefs = [...mcu.matchAll(/<d:ctr name="(FLEXCAN_PE_CLK[^"]*)"[\s\S]*?<d:var name="McuClockReferencePointFrequency"[^>]*value="([^"]*)"/g)]
  .map((m) => ({ name: m[1], frequency: m[2] }));

const peripherals = [...mcu.matchAll(/<d:ctr name="McuPeripheral_\d+"[\s\S]*?<d:var name="McuPeripheralName"[^>]*value="(FlexCAN_\d)"[\s\S]*?<d:var name="McuModeEntrySlot"[^>]*value="([^"]*)"[\s\S]*?<d:var name="McuPeripheralClockEnable"[^>]*value="([^"]*)"/g)]
  .map((m) => ({ name: m[1], slot: m[2], enabled: m[3] }));

const pins = [...port.matchAll(/<d:ctr name="([^"]*CAN\d+_(?:RXD|TXD))"[\s\S]*?<d:var name="PortPinMode"[^>]*value="([^"]*)"[\s\S]*?<d:ref name="PortPinSIUL2Instance"[^>]*value="([^"]*)"/g)]
  .map((m) => ({ pinConfig: m[1], mode: m[2], siul2: m[3] }));

const bases = [...s32.matchAll(/#define IP_CAN_(\d)_BASE\s+\(0x([0-9A-Fa-f]+)u\)/g)]
  .map((m) => ({ instance: `CAN_${m[1]}`, base: `0x${m[2].toUpperCase()}` }));

const cfgMacros = [...cfg.matchAll(/#define\s+(CAN_43_FLEXCAN_[A-Z0-9_]+)\s+\(?([^)\r\n]+)\)?/g)]
  .filter((m) => /HWCONTROLLER_SUPPORT|HWMB_COUNT|DEV_ERROR_DETECT|VERSION_INFO_API|SET_BAUDRATE_API|ABORT_MB_API|TIMESTAMP_ENABLE|DUAL_CLOCK|LISTEN_ONLY|MAINFUNCTION|HWOBJECT_CONFIG_COUNT|CONTROLLER_CONFIG_COUNT/.test(m[1]))
  .map((m) => ({ name: m[1], value: m[2].trim() }));

const ipCfg = [...flexPb.matchAll(/\/\* Can Hardware Channel (FLEXCAN_\d) \*\/([\s\S]*?)(?=\/\* Can Hardware Channel|};)/g)]
  .map((m) => {
    const t = m[2];
    const nums = [...t.matchAll(/\(uint8\)(\d+)U|FLEXCAN_PAYLOAD_SIZE_(\d+)|\(boolean\)(TRUE|FALSE)|FLEXCAN_(NORMAL_MODE|RXFIFO_USING_INTERRUPTS)|\{[\s\S]*?\}/g)];
    return {
      hwChannel: m[1],
      maxMb: t.match(/Number Of Message Buffer used[\s\S]*?\(uint8\)(\d+)U/)?.[1] ?? "",
      fdEnable: t.match(/Can FD enabled[\s\S]*?\(boolean\)(TRUE|FALSE)/)?.[1] ?? "",
      bitRateSwitch: t.match(/BRS for FD[\s\S]*?\(boolean\)(TRUE|FALSE)/)?.[1] ?? "",
      payloads: [...t.matchAll(/FLEXCAN_PAYLOAD_SIZE_(\d+)/g)].map((x) => x[1]),
      options: t.match(/Controller Options[\s\S]*?\(uint32\)\(([^)]*)\)/)?.[1]?.replace(/\s+/g, " ").trim() ?? "",
      normalBitrateTuple: t.match(/Values for normal baudrate[\s\S]*?\{\s*\(uint8\)(\d+)U,\s*\(uint8\)(\d+)U,\s*\(uint8\)(\d+)U,\s*\(uint16\)(\d+),\s*\(uint8\)(\d+)U\s*\}/)?.slice(1) ?? [],
      cbtBitrateTuple: t.match(/Values for CBT baudrate[\s\S]*?\{\s*\(uint8\)(\d+)U,\s*\(uint8\)(\d+)U,\s*\(uint8\)(\d+)U,\s*\(uint16\)(\d+)U?,\s*\(uint8\)(\d+)U\s*\}/)?.slice(1) ?? [],
    };
  });

const hwObjectComments = [...canPb.matchAll(/\/\* ([^*]*MailBox[^*]*)\*\/\s*\{([\s\S]*?)\n\s*\}/g)]
  .map((m) => ({ name: m[1].trim(), body: m[2].replace(/\s+/g, " ").trim().slice(0, 400) }));

const summary = {
  controllers,
  hohCount: hohs.length,
  hohs,
  hohByController: controllers.map((c) => ({
    controller: c.id,
    hwChannel: c.hwChannel,
    rx: hohs.filter((h) => h.controller === c.id && /RECEIVE/i.test(h.type)).length,
    tx: hohs.filter((h) => h.controller === c.id && /TRANSMIT/i.test(h.type)).length,
    total: hohs.filter((h) => h.controller === c.id).length,
  })),
  clockRefs,
  peripherals,
  pins,
  bases,
  cfgMacros,
  ipCfg,
  hwObjectComments: hwObjectComments.slice(0, 30),
};

console.log(JSON.stringify(summary, null, 2));
