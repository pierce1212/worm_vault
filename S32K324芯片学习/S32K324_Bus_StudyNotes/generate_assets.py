from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
PDF = Path(r"C:\Users\nvtc140\Zotero\storage\GKPNECE2\S32K3xx Reference Manual.pdf")


def render_page(doc: fitz.Document, page_no: int, name: str, zoom: float = 1.6) -> None:
    page = doc[page_no - 1]
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    pix.save(ASSETS / name)


def write_svg(name: str, body: str) -> None:
    (ASSETS / name).write_text(body, encoding="utf-8")


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(PDF)

    for page_no, name, zoom in [
        (24, "rm_p24_s32k324_block_diagram.png", 1.5),
        (53, "rm_p53_cm7_buses.png", 1.7),
        (498, "rm_p498_axbs_s32k324_matrix_part1.png", 1.7),
        (499, "rm_p499_axbs_s32k324_matrix_part2.png", 1.7),
        (500, "rm_p500_axbs_overview.png", 1.7),
        (37, "rm_p37_tcm_aips_memory_notes.png", 1.7),
        (649, "rm_p649_xbic_s32k324_config_part1.png", 1.7),
        (650, "rm_p650_xbic_s32k324_config_part2.png", 1.7),
        (670, "rm_p670_xrdc_mdac.png", 1.7),
        (672, "rm_p672_xrdc_mrc_pac.png", 1.7),
        (678, "rm_p678_xrdc_transaction_flow.png", 1.7),
        (888, "rm_p888_pramc_overview.png", 1.7),
        (889, "rm_p889_pramc_block_diagram.png", 1.7),
    ]:
        render_page(doc, page_no, name, zoom)

    write_svg(
        "s32k324_bus_big_picture.svg",
        """<svg xmlns="http://www.w3.org/2000/svg" width="1320" height="760" viewBox="0 0 1320 760">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#344054"/>
    </marker>
    <style>
      .title{font:700 26px Arial, sans-serif; fill:#111827}
      .sub{font:400 15px Arial, sans-serif; fill:#475467}
      .box{fill:#ffffff;stroke:#344054;stroke-width:2;rx:8}
      .core{fill:#e7f0ff;stroke:#175cd3}
      .mem{fill:#ecfdf3;stroke:#067647}
      .peri{fill:#fff7e6;stroke:#b54708}
      .guard{fill:#fef3f2;stroke:#b42318}
      .bus{fill:#f2f4f7;stroke:#475467}
      .label{font:700 16px Arial, sans-serif; fill:#101828}
      .small{font:400 13px Arial, sans-serif; fill:#344054}
      .arrow{stroke:#344054;stroke-width:2.2;fill:none;marker-end:url(#arrow)}
      .thin{stroke:#667085;stroke-width:1.5;fill:none;marker-end:url(#arrow)}
    </style>
  </defs>
  <text x="36" y="44" class="title">S32K324 内部总线大图：谁发起访问，谁负责转发，谁接收访问</text>
  <text x="36" y="72" class="sub">把它想成芯片内部的立交桥：Core/eDMA/HSE/EMAC 是车辆，AXBS 是主干立交，AIPS 是去外设寄存器的匝道，PFLASH/PRAMC/TCM 是目的地。</text>

  <rect x="42" y="110" width="250" height="170" class="box core"/>
  <text x="64" y="145" class="label">CM7_0 / CM7_1</text>
  <text x="64" y="176" class="small">AXI/AXIM：高带宽取指/数据</text>
  <text x="64" y="200" class="small">AHBP：外设访问路径</text>
  <text x="64" y="224" class="small">PPB：NVIC/SCB/MPU/MCM</text>
  <text x="64" y="248" class="small">TCM local：零等待私有 SRAM</text>

  <rect x="42" y="328" width="250" height="132" class="box core"/>
  <text x="64" y="363" class="label">eDMA3</text>
  <text x="64" y="394" class="small">自己成为 AHB master</text>
  <text x="64" y="418" class="small">通过 DMAMUX 接收外设请求</text>
  <text x="64" y="442" class="small">搬运 SRAM/Flash/外设数据</text>

  <rect x="42" y="504" width="250" height="108" class="box core"/>
  <text x="64" y="539" class="label">HSE-B / EMAC</text>
  <text x="64" y="570" class="small">非 CPU master</text>
  <text x="64" y="594" class="small">同样参与 AXBS 仲裁</text>

  <rect x="384" y="138" width="300" height="282" class="box bus"/>
  <text x="408" y="174" class="label">AXBS_0 Main Crossbar</text>
  <text x="408" y="205" class="small">S0/S1/S4：PFlash ports</text>
  <text x="408" y="229" class="small">S2/S6：PRAM0/PRAM1(system SRAM)</text>
  <text x="408" y="253" class="small">S3：Cortex-M7 TCM backdoor</text>
  <text x="408" y="277" class="small">S5：QuadSPI AHB</text>
  <text x="408" y="315" class="small">不同 master 访问不同 slave 可并行；</text>
  <text x="408" y="339" class="small">撞到同一 slave 时按每个 slave 的仲裁策略排队。</text>
  <rect x="430" y="360" width="212" height="38" class="guard"/>
  <text x="456" y="384" class="small">XBIC_0 监视主 AXBS</text>

  <rect x="760" y="112" width="250" height="126" class="box mem"/>
  <text x="784" y="146" class="label">PFLASH / DFLASH</text>
  <text x="784" y="177" class="small">非易失存储，XIP 取指</text>
  <text x="784" y="201" class="small">PFLASH 控制器在 AIPS 可配置</text>

  <rect x="760" y="270" width="250" height="126" class="box mem"/>
  <text x="784" y="304" class="label">PRAMC + System SRAM</text>
  <text x="784" y="335" class="small">64-bit AHB + ECC</text>
  <text x="784" y="359" class="small">CPU/DMA/EMAC 都可访问</text>

  <rect x="760" y="428" width="250" height="126" class="box mem"/>
  <text x="784" y="462" class="label">TCM Backdoor</text>
  <text x="784" y="493" class="small">别的 master 访问某 core TCM</text>
  <text x="784" y="517" class="small">和 core local TCM 路径不同</text>

  <rect x="384" y="488" width="300" height="124" class="box bus"/>
  <text x="408" y="524" class="label">AXBS_1 Peripheral Crossbar</text>
  <text x="408" y="555" class="small">连接 AHBP/eDMA/HSE 到 AIPS0/1/2</text>
  <text x="408" y="579" class="small">访问外设寄存器时走这里</text>
  <rect x="430" y="596" width="212" height="28" class="guard"/>
  <text x="462" y="616" class="small">XBIC_1 监视外设 AXBS</text>

  <rect x="760" y="604" width="250" height="104" class="box peri"/>
  <text x="784" y="638" class="label">AIPS_Lite 0/1/2</text>
  <text x="784" y="669" class="small">0x4000_0000-0x405F_FFFF</text>
  <text x="784" y="693" class="small">外设寄存器桥，强顺序/不可缓存</text>

  <rect x="1084" y="166" width="230" height="164" class="box guard"/>
  <text x="1106" y="200" class="label">XRDC</text>
  <text x="1106" y="231" class="small">MDAC：给 master 分 domain</text>
  <text x="1106" y="255" class="small">MRC：保护 Flash/SRAM/QSPI</text>
  <text x="1106" y="279" class="small">PAC：保护 AIPS 外设</text>
  <text x="1106" y="303" class="small">本项目 RM 中未启用配置</text>

  <rect x="1084" y="390" width="230" height="126" class="box guard"/>
  <text x="1106" y="424" class="label">XBIC / EDC</text>
  <text x="1106" y="455" class="small">监测地址/写数据/读反馈完整性</text>
  <text x="1106" y="479" class="small">错误可上报 FCCU</text>
  <text x="1106" y="503" class="small">本项目 RM 中启用</text>

  <path d="M292 184 C335 184 342 220 384 220" class="arrow"/>
  <path d="M292 390 C335 390 342 334 384 334" class="arrow"/>
  <path d="M292 558 C335 558 342 390 384 390" class="arrow"/>
  <path d="M684 196 C720 196 724 174 760 174" class="arrow"/>
  <path d="M684 298 C720 298 724 333 760 333" class="arrow"/>
  <path d="M684 374 C720 374 724 491 760 491" class="arrow"/>
  <path d="M684 552 C720 552 724 656 760 656" class="arrow"/>
  <path d="M1010 304 C1040 304 1050 262 1084 262" class="thin"/>
  <path d="M1010 452 C1040 452 1050 452 1084 452" class="thin"/>
</svg>
""",
    )

    write_svg(
        "s32k324_common_access_paths.svg",
        """<svg xmlns="http://www.w3.org/2000/svg" width="1320" height="720" viewBox="0 0 1320 720">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#344054"/>
    </marker>
    <style>
      .title{font:700 25px Arial, sans-serif; fill:#111827}
      .sub{font:400 14px Arial, sans-serif; fill:#475467}
      .box{fill:#fff;stroke:#344054;stroke-width:2;rx:8}
      .cpu{fill:#e7f0ff;stroke:#175cd3}
      .bus{fill:#f2f4f7;stroke:#475467}
      .mem{fill:#ecfdf3;stroke:#067647}
      .peri{fill:#fff7e6;stroke:#b54708}
      .warn{fill:#fef3f2;stroke:#b42318}
      .label{font:700 15px Arial, sans-serif; fill:#101828}
      .small{font:400 13px Arial, sans-serif; fill:#344054}
      .path1{stroke:#175cd3;stroke-width:3;fill:none;marker-end:url(#arrow)}
      .path2{stroke:#067647;stroke-width:3;fill:none;marker-end:url(#arrow)}
      .path3{stroke:#b54708;stroke-width:3;fill:none;marker-end:url(#arrow)}
      .path4{stroke:#b42318;stroke-width:3;fill:none;marker-end:url(#arrow)}
    </style>
  </defs>
  <text x="36" y="44" class="title">常见软件访问在硬件上真正走哪条路</text>
  <text x="36" y="72" class="sub">同一个 C 语句“读/写地址”，落到硬件上会选择完全不同的路径。调试性能、DMA 一致性、总线错误时，先画路径。</text>

  <rect x="56" y="122" width="190" height="82" class="box cpu"/><text x="78" y="157" class="label">CPU 取指</text><text x="78" y="182" class="small">.text / vector</text>
  <rect x="320" y="122" width="190" height="82" class="box bus"/><text x="342" y="157" class="label">AXI -> XHB400</text><text x="342" y="182" class="small">转成 AHB-Lite</text>
  <rect x="584" y="122" width="190" height="82" class="box bus"/><text x="606" y="157" class="label">AXBS_0</text><text x="606" y="182" class="small">Flash slave port</text>
  <rect x="848" y="122" width="214" height="82" class="box mem"/><text x="870" y="157" class="label">PFLASH</text><text x="870" y="182" class="small">0x0040_0000 起</text>
  <path d="M246 163 H320" class="path1"/><path d="M510 163 H584" class="path1"/><path d="M774 163 H848" class="path1"/>

  <rect x="56" y="258" width="190" height="82" class="box cpu"/><text x="78" y="293" class="label">CPU 读写外设</text><text x="78" y="318" class="small">CAN/LPSPI/ADC 寄存器</text>
  <rect x="320" y="258" width="190" height="82" class="box bus"/><text x="342" y="293" class="label">AHBP</text><text x="342" y="318" class="small">不做 speculative read</text>
  <rect x="584" y="258" width="190" height="82" class="box bus"/><text x="606" y="293" class="label">AXBS_1</text><text x="606" y="318" class="small">Peripheral crossbar</text>
  <rect x="848" y="258" width="214" height="82" class="box peri"/><text x="870" y="293" class="label">AIPS_Lite</text><text x="870" y="318" class="small">0x4000_0000-0x405F_FFFF</text>
  <path d="M246 299 H320" class="path3"/><path d="M510 299 H584" class="path3"/><path d="M774 299 H848" class="path3"/>

  <rect x="56" y="394" width="190" height="82" class="box cpu"/><text x="78" y="429" class="label">eDMA 搬运</text><text x="78" y="454" class="small">LPSPI/LPI2C 通道</text>
  <rect x="320" y="394" width="190" height="82" class="box bus"/><text x="342" y="429" class="label">DMAMUX -> eDMA</text><text x="342" y="454" class="small">请求路由不是数据总线</text>
  <rect x="584" y="394" width="190" height="82" class="box bus"/><text x="606" y="429" class="label">AXBS_2</text><text x="606" y="454" class="small">eDMA 专用 crossbar</text>
  <rect x="848" y="394" width="214" height="82" class="box mem"/><text x="870" y="429" class="label">SRAM / AIPS</text><text x="870" y="454" class="small">读源地址，写目的地址</text>
  <path d="M246 435 H320" class="path2"/><path d="M510 435 H584" class="path2"/><path d="M774 435 H848" class="path2"/>

  <rect x="56" y="530" width="190" height="82" class="box cpu"/><text x="78" y="565" class="label">访问 DTCM</text><text x="78" y="590" class="small">本核局部 or backdoor</text>
  <rect x="320" y="530" width="190" height="82" class="box mem"/><text x="342" y="565" class="label">Local TCM</text><text x="342" y="590" class="small">本核零等待，不经 AXBS</text>
  <rect x="584" y="530" width="190" height="82" class="box bus"/><text x="606" y="565" class="label">AXBS_3</text><text x="606" y="590" class="small">TCM backdoor</text>
  <rect x="848" y="530" width="214" height="82" class="box warn"/><text x="870" y="565" class="label">ECC/初始化风险</text><text x="870" y="590" class="small">读前必须先初始化</text>
  <path d="M246 571 H320" class="path1"/><path d="M510 571 H584" class="path4"/><path d="M774 571 H848" class="path4"/>

  <rect x="1110" y="122" width="230" height="476" class="box warn"/>
  <text x="1132" y="158" class="label">本项目配置观察</text>
  <text x="1132" y="196" class="small">Rm: XBIC = STD_ON</text>
  <text x="1132" y="222" class="small">Rm: DMA_MUX = STD_ON</text>
  <text x="1132" y="248" class="small">Rm: AXBS = STD_OFF</text>
  <text x="1132" y="274" class="small">Rm: XRDC = STD_OFF</text>
  <text x="1132" y="300" class="small">MPU: AIPS 强顺序/不可执行</text>
  <text x="1132" y="326" class="small">MPU: Flash/SRAM 可 cache</text>
  <text x="1132" y="352" class="small">MPU: non-cache/shared RAM</text>
  <text x="1132" y="378" class="small">用于 DMA buffer 更稳</text>
  <text x="1132" y="430" class="small">调试口诀：</text>
  <text x="1132" y="456" class="small">先问谁是 master，</text>
  <text x="1132" y="482" class="small">再问目标是哪个 slave，</text>
  <text x="1132" y="508" class="small">最后看 MPU/XRDC/XBIC。</text>
</svg>
""",
    )

    write_svg(
        "s32k324_axbs_instances.svg",
        """<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="690" viewBox="0 0 1280 690">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#344054"/></marker>
    <style>
      .title{font:700 25px Arial, sans-serif;fill:#111827}.sub{font:400 14px Arial, sans-serif;fill:#475467}
      .bus{fill:#f2f4f7;stroke:#475467;stroke-width:2;rx:8}.master{fill:#e7f0ff;stroke:#175cd3;stroke-width:2;rx:8}
      .slave{fill:#ecfdf3;stroke:#067647;stroke-width:2;rx:8}.guard{fill:#fef3f2;stroke:#b42318;stroke-width:2;rx:8}
      .label{font:700 15px Arial, sans-serif;fill:#101828}.small{font:400 12.5px Arial, sans-serif;fill:#344054}
      .arrow{stroke:#344054;stroke-width:2;fill:none;marker-end:url(#arrow)}
    </style>
  </defs>
  <text x="34" y="42" class="title">S32K324 的 AXBS 实例：不是一座桥，而是一组互相连接的桥</text>
  <text x="34" y="70" class="sub">AXBS_0 是主干；AXBS_1 管外设；AXBS_2 让 eDMA 同时去主干/外设；AXBS_3 是 TCM backdoor；AXBS_4 给 HSE_B 接入主干/外设。</text>
  <rect x="448" y="108" width="270" height="206" class="bus"/><text x="470" y="142" class="label">AXBS_0 Main</text><text x="470" y="172" class="small">M0 CM7_0 AHBM</text><text x="470" y="196" class="small">M1 AXBS_2 S0</text><text x="470" y="220" class="small">M2 HSE_B</text><text x="470" y="244" class="small">M3 EMAC</text><text x="470" y="268" class="small">M4 CM7_1 AHBM</text><text x="470" y="292" class="small">Slaves: Flash0/1/2, PRAM0/1, TCM, QSPI</text>
  <rect x="448" y="388" width="270" height="166" class="bus"/><text x="470" y="422" class="label">AXBS_1 Peripheral</text><text x="470" y="452" class="small">M0 CM7_0 AHBP</text><text x="470" y="476" class="small">M1 AXBS_2 S1</text><text x="470" y="500" class="small">M2 HSE_B</text><text x="470" y="524" class="small">M3 CM7_1 AHBP</text><text x="470" y="548" class="small">Slaves: AIPS0/AIPS1/AIPS2</text>
  <rect x="106" y="250" width="208" height="116" class="master"/><text x="128" y="284" class="label">AXBS_2 eDMA</text><text x="128" y="314" class="small">M0 eDMA</text><text x="128" y="338" class="small">S0 -> AXBS_0</text><text x="128" y="362" class="small">S1 -> AXBS_1</text>
  <rect x="860" y="178" width="218" height="116" class="bus"/><text x="882" y="212" class="label">AXBS_3 TCM</text><text x="882" y="242" class="small">M0 AXBS_0 S3</text><text x="882" y="266" class="small">S0 CM7_0 TCM</text><text x="882" y="290" class="small">S1 CM7_1 TCM</text>
  <rect x="860" y="404" width="218" height="116" class="bus"/><text x="882" y="438" class="label">AXBS_4 HSE</text><text x="882" y="468" class="small">M0 HSE_B</text><text x="882" y="492" class="small">S0 -> AXBS_0 M2</text><text x="882" y="516" class="small">S1 -> AXBS_1 M2</text>
  <rect x="1120" y="178" width="200" height="116" class="guard"/><text x="1142" y="212" class="label">XBIC_3</text><text x="1142" y="242" class="small">监测 TCM AXBS</text><text x="1142" y="266" class="small">项目 MCR=0xC0800000</text>
  <rect x="744" y="108" width="200" height="82" class="guard"/><text x="766" y="142" class="label">XBIC_0</text><text x="766" y="166" class="small">监测 Main AXBS</text>
  <rect x="744" y="388" width="200" height="82" class="guard"/><text x="766" y="422" class="label">XBIC_1</text><text x="766" y="446" class="small">监测 Peripheral AXBS</text>
  <rect x="72" y="410" width="200" height="82" class="guard"/><text x="94" y="444" class="label">XBIC_2</text><text x="94" y="468" class="small">监测 eDMA AXBS</text>
  <path d="M314 286 C370 260 392 218 448 210" class="arrow"/><path d="M314 338 C370 370 392 442 448 462" class="arrow"/>
  <path d="M718 230 C770 224 808 230 860 236" class="arrow"/><path d="M860 462 C806 462 776 460 718 462" class="arrow"/>
  <path d="M744 150 L718 162" class="arrow"/><path d="M744 430 L718 438" class="arrow"/><path d="M272 444 L314 358" class="arrow"/><path d="M1120 236 H1078" class="arrow"/>
  <rect x="58" y="580" width="1160" height="58" class="slave"/><text x="78" y="615" class="small">读图方法：AXBS 名字后面的括号不是地址区，而是功能角色。真正地址仍由 4G memory map 决定，AXBS 只负责把“master 发出的地址访问”送到对应 slave 端口，并在冲突时仲裁。</text>
</svg>
""",
    )


if __name__ == "__main__":
    main()
