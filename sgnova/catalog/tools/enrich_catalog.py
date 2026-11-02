#!/usr/bin/env python3
"""Enrich the synthetic SGNova electronics fixtures.

Reads  sgnova/catalog/products.json (600 fixtures, unchanged)
Writes sgnova/catalog/products.enriched.json
       apps/storefront/public/catalog/<category>/<n>.svg  (original illustrations)

Deterministic: rerunning produces identical output. Brands are fictional and
every specification is an illustrative test-fixture value, not a manufacturer
claim. Specs scale with each product's existing BDT price rank inside its
category, so cheaper items get lower-end specs.
"""
import json
import os
import random

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
SRC = os.path.join(ROOT, "sgnova/catalog/products.json")
OUT = os.path.join(ROOT, "sgnova/catalog/products.enriched.json")
IMG_DIR = os.path.join(ROOT, "apps/storefront/public/catalog")
IMG_VARIANTS = 4

DISCLAIMER = (
    "Test catalog item from a fictional brand. Specifications, pricing and "
    "the product illustration are representative test-fixture data, not "
    "manufacturer claims."
)


def pick(seq, t):
    """Pick from an ascending list by tier fraction t in [0, 1]."""
    return seq[min(len(seq) - 1, int(t * len(seq)))]


def specs_for(cat, t, r):
    """Return (model_suffix, descriptor, highlights, spec_groups)."""
    if cat == "processor":
        cores = pick([4, 6, 6, 8, 12, 16, 24], t)
        threads = cores * 2 if cores < 24 else 32
        boost = round(4.2 + t * 1.6, 1)
        sock = r.choice(["AM5", "LGA1700"])
        model = f"N{pick([3, 5, 5, 7, 7, 9], t)} {7400 + int(t * 600) // 100 * 100}{r.choice(['', 'X', 'K'])}"
        return model, f"{cores}-Core Desktop Processor", [
            f"{cores} cores / {threads} threads", f"Up to {boost} GHz boost", f"Socket {sock}"
        ], [
            ("Performance", [("Cores", cores), ("Threads", threads), ("Base clock", f"{round(boost - 1.3, 1)} GHz"),
                             ("Max boost clock", f"{boost} GHz"), ("L3 cache", f"{pick([12, 16, 24, 32, 36, 64], t)} MB")]),
            ("Platform", [("Socket", sock), ("Memory support", "DDR5"), ("PCIe", "PCIe 5.0"),
                          ("Integrated graphics", r.choice(["Yes", "No"]))]),
            ("Power", [("TDP", f"{pick([65, 65, 105, 125, 170], t)} W"), ("Cooler included", "Yes" if t < 0.4 else "No")]),
        ]
    if cat == "motherboard":
        chip = pick(["B650M", "B650", "B760", "X670", "Z790", "X870E"], t)
        ff = pick(["Micro-ATX", "ATX", "ATX", "E-ATX"], t)
        return f"{chip} {r.choice(['Plus', 'Pro', 'Gaming', 'Elite'])}", f"{ff} Motherboard", [
            f"{chip} chipset", f"{ff} form factor", "DDR5 memory"
        ], [
            ("Platform", [("Chipset", chip), ("Socket", "AM5" if chip.startswith(("B650", "X")) else "LGA1700"),
                          ("Form factor", ff)]),
            ("Memory", [("Memory slots", 2 if ff == "Micro-ATX" else 4), ("Type", "DDR5"),
                        ("Max capacity", f"{pick([96, 128, 192], t)} GB")]),
            ("Expansion & storage", [("PCIe x16 slots", pick([1, 2, 3], t)), ("M.2 slots", pick([2, 3, 4, 5], t)),
                                     ("SATA ports", 4)]),
            ("Connectivity", [("LAN", pick(["1 GbE", "2.5 GbE", "2.5 GbE", "10 GbE"], t)),
                              ("Wi-Fi", pick(["None", "Wi-Fi 6E", "Wi-Fi 7"], t)), ("USB-C rear", "Yes")]),
        ]
    if cat == "graphics-card":
        vram = pick([8, 8, 12, 16, 16, 24], t)
        model = f"PX {pick([5060, 6060, 7060, 7070, 8070, 9080], t)}"
        return model, f"{vram}GB Graphics Card", [
            f"{vram} GB GDDR{6 if t < 0.4 else 7}", "Ray tracing support", f"{pick([2, 3, 3], t)}-fan cooler"
        ], [
            ("Graphics", [("GPU", model), ("Memory", f"{vram} GB GDDR{6 if t < 0.4 else 7}"),
                          ("Memory bus", f"{pick([128, 192, 256, 384], t)}-bit"),
                          ("Boost clock", f"{2400 + int(t * 500)} MHz")]),
            ("Outputs", [("HDMI", "1 x HDMI 2.1"), ("DisplayPort", "3 x DP 2.1"), ("Max displays", 4)]),
            ("Power & size", [("Recommended PSU", f"{pick([550, 650, 750, 850, 1000], t)} W"),
                              ("Power connector", pick(["8-pin", "2 x 8-pin", "16-pin"], t)),
                              ("Card length", f"{240 + int(t * 100)} mm"), ("Slots", pick([2, 2.5, 3], t))]),
        ]
    if cat in ("desktop-ram", "laptop-ram"):
        cap = pick([8, 16, 16, 32, 32, 64], t)
        kit = "2 x " + str(cap // 2) + " GB" if cap >= 16 and cat == "desktop-ram" else f"1 x {cap} GB"
        speed = pick([4800, 5200, 5600, 6000, 6400, 7200], t)
        ff = "DIMM" if cat == "desktop-ram" else "SO-DIMM"
        return f"Flux {speed}", f"{cap}GB DDR5 {ff} Memory", [
            f"{cap} GB ({kit})", f"DDR5-{speed}", f"CL{pick([40, 36, 32, 30], t)}"
        ], [
            ("Memory", [("Capacity", f"{cap} GB"), ("Kit", kit), ("Type", "DDR5"), ("Form factor", ff)]),
            ("Performance", [("Speed", f"{speed} MT/s"), ("CAS latency", f"CL{pick([40, 36, 32, 30], t)}"),
                             ("Voltage", f"{pick([1.1, 1.25, 1.35, 1.4], t)} V"),
                             ("Profiles", "XMP 3.0 / EXPO" if cat == "desktop-ram" else "JEDEC")]),
            ("Design", [("Heat spreader", "Aluminium" if cat == "desktop-ram" else "None"),
                        ("RGB", "Yes" if cat == "desktop-ram" and t > 0.5 else "No")]),
        ]
    if cat == "internal-ssd":
        cap = pick(["250 GB", "500 GB", "1 TB", "1 TB", "2 TB", "4 TB"], t)
        gen = pick(["PCIe 3.0", "PCIe 4.0", "PCIe 4.0", "PCIe 5.0"], t)
        read = pick([3500, 5000, 7000, 7400, 12000], t)
        return f"Swift {pick(['S3', 'S5', 'S7', 'S9'], t)}", f"{cap} NVMe M.2 SSD", [
            f"{cap} capacity", f"Up to {read} MB/s read", gen
        ], [
            ("Storage", [("Capacity", cap), ("Form factor", "M.2 2280"), ("Interface", f"NVMe {gen} x4"),
                         ("NAND", "3D TLC")]),
            ("Performance", [("Sequential read", f"{read} MB/s"), ("Sequential write", f"{int(read * 0.9)} MB/s")]),
            ("Reliability", [("Endurance", f"{pick([150, 300, 600, 1200, 2400], t)} TBW"), ("MTBF", "1.5 million hours")]),
        ]
    if cat == "hard-drive":
        cap = pick(["1 TB", "2 TB", "4 TB", "6 TB", "8 TB", "12 TB"], t)
        use = pick(["Desktop", "Desktop", "NAS", "Surveillance", "NAS"], t)
        return f"Vault {use[:3].upper()}", f"{cap} 3.5\" {use} Hard Drive", [
            f"{cap} capacity", f"{pick([5400, 7200], t)} RPM", f"{use} optimised"
        ], [
            ("Storage", [("Capacity", cap), ("Form factor", '3.5"'), ("Interface", "SATA 6 Gb/s"),
                         ("Spindle speed", f"{pick([5400, 7200], t)} RPM"), ("Cache", f"{pick([64, 128, 256, 512], t)} MB")]),
            ("Usage", [("Optimised for", use), ("Workload rating", f"{pick([55, 180, 300], t)} TB/year")]),
        ]
    if cat == "power-supply":
        w = pick([450, 550, 650, 750, 850, 1000, 1200], t)
        eff = pick(["80 Plus Bronze", "80 Plus Bronze", "80 Plus Gold", "80 Plus Gold", "80 Plus Platinum"], t)
        mod = pick(["Non-modular", "Semi-modular", "Fully modular", "Fully modular"], t)
        return f"Volt {w}", f"{w}W {eff.replace('80 Plus ', '')} Power Supply", [
            f"{w} W continuous", eff, mod
        ], [
            ("Power", [("Wattage", f"{w} W"), ("Efficiency", eff), ("ATX version", "ATX 3.1" if t > 0.4 else "ATX 2.53")]),
            ("Design", [("Modularity", mod), ("Fan", "120 mm fluid dynamic" if t > 0.4 else "120 mm sleeve"),
                        ("Protections", "OVP, UVP, OCP, OPP, SCP")]),
            ("Connectors", [("PCIe", "1 x 12V-2x6 + 2 x 8-pin" if t > 0.4 else "2 x 6+2-pin"), ("SATA", pick([4, 6, 8], t))]),
        ]
    if cat == "computer-case":
        ff = pick(["Micro-ATX Mini Tower", "ATX Mid Tower", "ATX Mid Tower", "E-ATX Full Tower"], t)
        fans = pick([1, 2, 3, 4, 6], t)
        return f"Shell {pick(['M', 'A', 'X'], t)}{20 + int(t * 60)}", f"{ff} Case", [
            ff, "Tempered glass side panel", f"{fans} fans included"
        ], [
            ("Design", [("Type", ff), ("Side panel", "Tempered glass"), ("Colour", r.choice(["Black", "White"]))]),
            ("Compatibility", [("Motherboards", "Mini-ITX to " + ff.split()[0]),
                               ("Max GPU length", f"{330 + int(t * 90)} mm"),
                               ("Max CPU cooler height", f"{155 + int(t * 25)} mm")]),
            ("Cooling", [("Included fans", fans), ("Radiator support", pick(["240 mm", "280 mm", "360 mm", "420 mm"], t))]),
            ("Front I/O", [("Ports", "USB-C, 2 x USB-A, audio")]),
        ]
    if cat == "cpu-cooler":
        typ = pick(["Air", "Air", "Liquid 240 mm", "Liquid 280 mm", "Liquid 360 mm"], t)
        return f"Frost {pick(['A4', 'A6', 'L24', 'L28', 'L36'], t)}", f"{typ} CPU Cooler", [
            typ + " cooling", f"Up to {pick([150, 200, 250, 280, 300], t)} W TDP", "AM5 / LGA1700 ready"
        ], [
            ("Cooling", [("Type", typ), ("TDP rating", f"{pick([150, 200, 250, 280, 300], t)} W"),
                         ("Fans", pick(["1 x 120 mm", "2 x 120 mm", "2 x 120 mm", "2 x 140 mm", "3 x 120 mm"], t)),
                         ("Noise", f"{pick([28, 30, 32, 34], t)} dBA max")]),
            ("Compatibility", [("Sockets", "AM4, AM5, LGA1700, LGA1851")]),
            ("Lighting", [("ARGB", "Yes" if t > 0.3 else "No")]),
        ]
    if cat in ("gaming-laptop", "business-laptop"):
        gaming = cat == "gaming-laptop"
        screen = pick([15.6, 16, 16, 17.3] if gaming else [14, 14, 15.6, 16], t)
        ram = pick([16, 16, 32, 32, 64] if gaming else [8, 16, 16, 32], t)
        ssd = pick(["512 GB", "1 TB", "1 TB", "2 TB"], t)
        cpu = f"N{pick([5, 7, 7, 9], t)} {7400 + int(t * 500) // 100 * 100}H"
        gpu = f"PX {pick([5050, 5060, 6060, 7070, 8080], t)} {pick([6, 8, 8, 12, 16], t)}GB" if gaming else "Integrated graphics"
        hz = pick([144, 165, 240, 240], t) if gaming else 60
        model = (f"Raptor {pick(['G5', 'G7', 'G9'], t)}" if gaming else f"Workmate {pick(['B3', 'B5', 'B7'], t)}")
        return model, f"{screen}\" {'Gaming' if gaming else 'Business'} Laptop", [
            cpu, f"{ram} GB RAM / {ssd} SSD", gpu if gaming else f"{screen}\" {pick(['FHD', 'FHD', 'QHD'], t)} anti-glare"
        ], [
            ("Processor & graphics", [("Processor", cpu), ("Graphics", gpu)]),
            ("Memory & storage", [("RAM", f"{ram} GB DDR5"), ("Storage", f"{ssd} NVMe SSD")]),
            ("Display", [("Size", f'{screen}"'), ("Resolution", pick(["1920 x 1080", "1920 x 1200", "2560 x 1600"], t)),
                         ("Refresh rate", f"{hz} Hz"), ("Panel", "IPS")]),
            ("Battery & build", [("Battery", f"{pick([56, 70, 80, 90], t)} Wh"),
                                 ("Weight", f"{round((2.2 if gaming else 1.3) + t * 0.6, 2)} kg"),
                                 ("Operating system", "Windows 11 Home" if gaming else "Windows 11 Pro")]),
            ("Connectivity", [("Wireless", "Wi-Fi 6E, Bluetooth 5.3"), ("Ports", "USB-C, 2 x USB-A, HDMI, audio")]),
        ]
    if cat == "desktop-pc":
        cpu = f"N{pick([3, 5, 5, 7, 9], t)} {7400 + int(t * 500) // 100 * 100}"
        ram = pick([8, 16, 16, 32, 64], t)
        gpu = pick(["Integrated graphics", "PX 5060 8GB", "PX 6060 8GB", "PX 7070 12GB", "PX 9080 24GB"], t)
        use = "Office" if t < 0.25 else ("Creator" if t < 0.55 else "Gaming")
        return f"Tower {use[0]}{int(t * 9) + 1}", f"{use} Desktop PC", [cpu, f"{ram} GB RAM", gpu], [
            ("Processor & graphics", [("Processor", cpu), ("Graphics", gpu)]),
            ("Memory & storage", [("RAM", f"{ram} GB DDR5"), ("Storage", pick(["512 GB SSD", "1 TB SSD", "2 TB SSD"], t))]),
            ("System", [("Power supply", f"{pick([300, 550, 650, 850], t)} W"), ("Operating system", "Windows 11 Home"),
                        ("Wireless", "Wi-Fi 6, Bluetooth 5.2")]),
        ]
    if cat in ("gaming-monitor", "office-monitor"):
        gaming = cat == "gaming-monitor"
        size = pick([24, 27, 27, 32, 34] if gaming else [22, 24, 24, 27, 27], t)
        res = pick(["1920 x 1080", "2560 x 1440", "2560 x 1440", "3840 x 2160"], t)
        hz = pick([144, 165, 180, 240, 360], t) if gaming else pick([75, 100, 100, 120], t)
        panel = pick(["IPS", "IPS", "Fast IPS", "OLED"], t) if gaming else "IPS"
        return f"View {pick(['G', 'Q', 'U'], t) if gaming else 'O'}{size}", f'{size}" {res.split(" x ")[1]}p {hz}Hz {"Gaming" if gaming else "Office"} Monitor', [
            f'{size}" {panel}', res, f"{hz} Hz" + (", 1 ms" if gaming else "")
        ], [
            ("Display", [("Size", f'{size}"'), ("Resolution", res), ("Panel", panel), ("Refresh rate", f"{hz} Hz"),
                         ("Response time", "1 ms (GtG)" if gaming else "5 ms"),
                         ("HDR", pick(["None", "HDR10", "HDR400", "HDR True Black 400"], t))]),
            ("Connectivity", [("Inputs", "2 x HDMI, 1 x DisplayPort" + (", USB-C 65 W" if not gaming and t > 0.5 else ""))]),
            ("Ergonomics", [("Stand", "Height, tilt, swivel" if t > 0.4 else "Tilt"), ("VESA", "100 x 100")]),
        ]
    if cat == "mechanical-keyboard":
        lay = pick(["60%", "75%", "TKL", "Full-size"], r.random())
        sw = r.choice(["Linear Red", "Tactile Brown", "Clicky Blue"])
        conn = pick(["Wired USB-C", "Wired USB-C", "Tri-mode (2.4 GHz / Bluetooth / USB-C)"], t)
        return f"Keys {lay.replace('%', '')}", f"{lay} Mechanical Keyboard", [lay + " layout", sw + " switches", conn], [
            ("Keyboard", [("Layout", lay), ("Switches", sw), ("Hot-swappable", "Yes" if t > 0.3 else "No"),
                          ("Keycaps", "PBT double-shot" if t > 0.5 else "ABS")]),
            ("Connectivity", [("Connection", conn), ("Polling rate", "1000 Hz")]),
            ("Lighting", [("Backlight", "Per-key RGB" if t > 0.2 else "White")]),
        ]
    if cat == "gaming-mouse":
        dpi = pick([8000, 12000, 16000, 26000, 30000], t)
        wl = t > 0.45
        return f"Glide {pick(['M1', 'M3', 'M5', 'M7'], t)}", ("Wireless " if wl else "") + "Gaming Mouse", [
            f"{dpi} DPI sensor", f"{pick([85, 72, 63, 58], t)} g", "Wireless 2.4 GHz" if wl else "Wired USB"
        ], [
            ("Sensor", [("Max DPI", dpi), ("Max acceleration", f"{pick([35, 40, 50], t)} G"), ("Polling rate", "1000 Hz")]),
            ("Design", [("Weight", f"{pick([85, 72, 63, 58], t)} g"), ("Buttons", pick([6, 6, 7, 8], t)),
                        ("Switch rating", f"{pick([20, 60, 80, 90], t)} million clicks")]),
            ("Connectivity", [("Connection", "2.4 GHz wireless / USB-C" if wl else "Wired USB"),
                              ("Battery", f"{pick([70, 90, 120], t)} hours" if wl else "N/A")]),
        ]
    if cat == "headphone":
        typ = pick(["Wired over-ear", "Wireless on-ear", "Wireless over-ear", "Wireless over-ear ANC"], t)
        return f"Aura {pick(['H2', 'H4', 'H6', 'H8'], t)}", f"{typ} Headphones", [
            typ, f"{pick([20, 30, 40, 50], t)} hour battery" if "Wireless" in typ else "3.5 mm jack",
            "Active noise cancelling" if "ANC" in typ else "Passive isolation"
        ], [
            ("Audio", [("Type", typ), ("Drivers", f"{pick([40, 40, 50], t)} mm dynamic"), ("Frequency response", "20 Hz - 20 kHz"),
                       ("Noise cancelling", "Active (ANC)" if "ANC" in typ else "Passive")]),
            ("Connectivity", [("Bluetooth", "5.3" if "Wireless" in typ else "N/A"),
                              ("Battery life", f"{pick([20, 30, 40, 50], t)} hours" if "Wireless" in typ else "N/A"),
                              ("Charging", "USB-C" if "Wireless" in typ else "N/A")]),
            ("Microphone", [("Built-in mic", "Yes")]),
        ]
    if cat == "microphone":
        typ = pick(["USB condenser", "USB condenser", "USB/XLR dynamic", "XLR condenser"], t)
        return f"Vox {pick(['C1', 'C3', 'D5', 'X7'], t)}", f"{typ} Microphone", [
            typ, pick(["Cardioid", "Cardioid", "4 polar patterns"], t), f"{pick([16, 24, 24, 32], t)}-bit / {pick([48, 96, 192], t)} kHz"
        ], [
            ("Audio", [("Type", typ), ("Polar pattern", pick(["Cardioid", "Cardioid", "Cardioid, omni, bi, stereo"], t)),
                       ("Bit depth", f"{pick([16, 24, 24, 32], t)}-bit"), ("Sample rate", f"{pick([48, 96, 192], t)} kHz")]),
            ("Features", [("Headphone monitoring", "Yes"), ("Mute button", "Touch" if t > 0.4 else "Physical"),
                          ("Mount", "Desk stand + 5/8\" thread")]),
        ]
    if cat == "webcam":
        res = pick(["720p", "1080p", "1080p", "1440p", "4K"], t)
        return f"Lens {pick(['W1', 'W3', 'W5', 'W9'], t)}", f"{res} Webcam", [
            f"{res} at {pick([30, 30, 60], t)} fps", "Dual microphones", "Auto focus" if t > 0.3 else "Fixed focus"
        ], [
            ("Video", [("Resolution", res), ("Frame rate", f"{pick([30, 30, 60], t)} fps"), ("Field of view", f"{pick([78, 90, 90], t)}°"),
                       ("Focus", "Auto" if t > 0.3 else "Fixed"), ("HDR", "Yes" if t > 0.6 else "No")]),
            ("Audio & privacy", [("Microphones", "Dual stereo"), ("Privacy shutter", "Yes")]),
            ("Connectivity", [("Interface", "USB-C" if t > 0.5 else "USB-A"), ("Mount", "Monitor clip + tripod thread")]),
        ]
    if cat == "smartphone":
        storage = pick(["128 GB", "128 GB", "256 GB", "256 GB", "512 GB"], t)
        ram = pick([6, 8, 8, 12, 16], t)
        return f"Nova {pick(['A', 'S', 'X'], t)}{int(t * 9) + 1}", f"{storage} 5G Smartphone", [
            f'{pick([6.5, 6.6, 6.7, 6.8], t)}" AMOLED {pick([90, 120, 120], t)} Hz', f"{ram} GB RAM / {storage}",
            f"{pick([50, 50, 108, 200], t)} MP main camera"
        ], [
            ("Display", [("Size", f'{pick([6.5, 6.6, 6.7, 6.8], t)}"'), ("Panel", "AMOLED"), ("Refresh rate", f"{pick([90, 120, 120], t)} Hz")]),
            ("Performance", [("Chipset", f"Octa-core {pick(['2.4', '2.8', '3.2', '3.4'], t)} GHz"), ("RAM", f"{ram} GB"),
                             ("Storage", storage)]),
            ("Camera", [("Rear", f"{pick([50, 50, 108, 200], t)} MP main + {pick([2, 8, 12, 12], t)} MP"),
                        ("Front", f"{pick([16, 32, 32], t)} MP")]),
            ("Battery & connectivity", [("Battery", f"{pick([5000, 5000, 4800, 5500], t)} mAh"),
                                        ("Charging", f"{pick([25, 33, 67, 100], t)} W wired"),
                                        ("Network", "5G, Wi-Fi 6, Bluetooth 5.3"), ("SIM", "Dual nano-SIM")]),
        ]
    if cat == "tablet":
        size = pick([8.7, 10.5, 11, 12.4, 13], t)
        storage = pick(["64 GB", "128 GB", "256 GB", "512 GB"], t)
        return f"Slate {pick(['T8', 'T10', 'T11', 'T13'], t)}", f'{size}" Tablet {storage}', [
            f'{size}" {pick(["LCD", "LCD", "AMOLED"], t)} display', storage + " storage", "Stylus support" if t > 0.5 else "Quad speakers"
        ], [
            ("Display", [("Size", f'{size}"'), ("Panel", pick(["LCD", "LCD", "AMOLED"], t)), ("Refresh rate", f"{pick([60, 90, 120], t)} Hz")]),
            ("Performance", [("RAM", f"{pick([4, 6, 8, 12], t)} GB"), ("Storage", storage), ("microSD", "Up to 1 TB")]),
            ("Battery & connectivity", [("Battery", f"{pick([5100, 7040, 8000, 10090], t)} mAh"),
                                        ("Network", pick(["Wi-Fi", "Wi-Fi", "Wi-Fi + 4G LTE", "Wi-Fi + 5G"], t)),
                                        ("Stylus", "Supported" if t > 0.5 else "Not supported")]),
        ]
    if cat == "smartwatch":
        return f"Pulse {pick(['W2', 'W4', 'W6', 'W8'], t)}", f'{pick(["Fitness Band", "Smartwatch", "Smartwatch", "GPS Smartwatch"], t)}', [
            f'{pick([1.4, 1.43, 1.5, 1.9], t)}" AMOLED', f"{pick([7, 10, 14, 4], t)} day battery",
            "Built-in GPS" if t > 0.5 else "Heart-rate + SpO2"
        ], [
            ("Display", [("Size", f'{pick([1.4, 1.43, 1.5, 1.9], t)}"'), ("Panel", "AMOLED"), ("Always-on", "Yes" if t > 0.3 else "No")]),
            ("Health & sport", [("Sensors", "Heart rate, SpO2, sleep" + (", skin temperature" if t > 0.6 else "")),
                                ("Sport modes", pick([100, 120, 150], t)), ("GPS", "Built-in" if t > 0.5 else "Connected")]),
            ("Battery & build", [("Battery life", f"Up to {pick([7, 10, 14, 4], t)} days"), ("Water resistance", "5 ATM"),
                                 ("Calling", "Bluetooth calling" if t > 0.3 else "No")]),
        ]
    if cat == "router":
        std = pick(["Wi-Fi 5 AC1200", "Wi-Fi 6 AX1800", "Wi-Fi 6 AX3000", "Wi-Fi 6E AXE5400", "Wi-Fi 7 BE9300"], t)
        return f"Link {std.split()[-1]}", f"{std} Router", [
            std, f"{pick(['Dual', 'Dual', 'Dual', 'Tri', 'Tri'], t)}-band", f"{pick(['4 x 1 GbE', '4 x 1 GbE', '2.5 GbE WAN'], t)}"
        ], [
            ("Wireless", [("Standard", std), ("Bands", pick(["Dual-band", "Dual-band", "Dual-band", "Tri-band", "Tri-band"], t)),
                          ("Antennas", pick([4, 4, 5, 6, 8], t)), ("Mesh", "Supported" if t > 0.3 else "No")]),
            ("Wired", [("WAN", pick(["1 GbE", "1 GbE", "2.5 GbE"], t)), ("LAN", pick(["3 x 1 GbE", "4 x 1 GbE", "4 x 1 GbE + 2.5 GbE"], t))]),
            ("Features", [("Security", "WPA3, guest network"), ("Parental controls", "Yes"), ("USB", "USB 3.0" if t > 0.5 else "None")]),
        ]
    if cat == "network-switch":
        ports = pick([5, 8, 16, 24, 48], t)
        managed = pick(["Unmanaged", "Unmanaged", "Smart managed", "Managed L2"], t)
        return f"Mesh {ports}{'P' if t > 0.6 else ''}", f"{ports}-Port Gigabit {managed} Switch", [
            f"{ports} x 1 GbE", managed, "PoE+" if t > 0.6 else "Fanless"
        ], [
            ("Ports", [("RJ45 ports", f"{ports} x 10/100/1000"), ("SFP uplinks", pick([0, 0, 2, 4], t)),
                       ("PoE", f"PoE+ {pick([65, 120, 250, 370], t)} W" if t > 0.6 else "No")]),
            ("Management", [("Type", managed), ("VLAN", "802.1Q" if "anaged" in managed and managed != "Unmanaged" else "No")]),
            ("Hardware", [("Switching capacity", f"{ports * 2} Gbps"), ("Mounting", "Desktop" if ports <= 8 else "Rack / desktop"),
                          ("Cooling", "Fanless" if ports <= 16 else "Fan")]),
        ]
    if cat == "printer":
        typ = pick(["Inkjet", "Ink tank", "Ink tank", "Mono laser", "Colour laser"], t)
        return f"Print {pick(['P2', 'P4', 'P6', 'L8'], t)}", f"{typ} {'All-in-One ' if t > 0.3 else ''}Printer", [
            typ, f"{pick([8, 12, 22, 30, 38], t)} ppm", "Print / scan / copy" if t > 0.3 else "Print only"
        ], [
            ("Printing", [("Technology", typ), ("Speed (mono)", f"{pick([8, 12, 22, 30, 38], t)} ppm"),
                          ("Max resolution", f"{pick([1200, 4800, 4800, 1200], t)} dpi"), ("Duplex", "Automatic" if t > 0.5 else "Manual")]),
            ("Functions", [("Functions", "Print, scan, copy" if t > 0.3 else "Print")]),
            ("Connectivity", [("Interfaces", "USB, Wi-Fi" + (", Ethernet" if t > 0.6 else "")), ("Mobile printing", "Yes")]),
        ]
    if cat == "scanner":
        typ = pick(["Flatbed", "Flatbed", "Sheet-fed document", "Sheet-fed document"], t)
        return f"Scan {pick(['F1', 'F3', 'D5', 'D7'], t)}", f"{typ} Scanner", [
            typ, f"{pick([1200, 2400, 600, 600], t)} dpi optical", f"{pick([10, 15, 30, 45], t)} ppm" if "Sheet" in typ else "A4 bed"
        ], [
            ("Scanning", [("Type", typ), ("Optical resolution", f"{pick([1200, 2400, 600, 600], t)} dpi"),
                          ("Speed", f"{pick([10, 15, 30, 45], t)} ppm" if "Sheet" in typ else "10 s per A4 page"),
                          ("ADF capacity", f"{pick([20, 50], t)} sheets" if "Sheet" in typ else "N/A"),
                          ("Duplex", "Single-pass" if "Sheet" in typ else "No")]),
            ("Connectivity", [("Interface", "USB" + (", Wi-Fi" if t > 0.5 else "")), ("Output", "PDF, searchable PDF, JPEG")]),
        ]
    if cat == "ups":
        va = pick([650, 850, 1200, 1500, 2000, 3000], t)
        topo = pick(["Offline", "Line-interactive", "Line-interactive", "Online double-conversion"], t)
        return f"Guard {va}", f"{va}VA {topo} UPS", [
            f"{va} VA / {int(va * 0.6)} W", topo, f"{pick([4, 6, 8], t)} outlets"
        ], [
            ("Power", [("Capacity", f"{va} VA / {int(va * 0.6)} W"), ("Topology", topo),
                       ("Output waveform", "Pure sine wave" if t > 0.5 else "Simulated sine wave"),
                       ("Input voltage", "140-300 V AC")]),
            ("Battery", [("Battery", f"{pick([1, 2, 2, 4], t)} x 12 V {pick([7, 9, 9], t)} Ah"),
                         ("Backup (half load)", f"{pick([10, 12, 15, 20], t)} minutes"), ("Recharge time", "6-8 hours")]),
            ("Outlets & features", [("Outlets", f"{pick([4, 6, 8], t)} universal"), ("AVR", "Yes"),
                                    ("Display", "LCD" if t > 0.3 else "LED"), ("USB monitoring", "Yes" if t > 0.3 else "No")]),
        ]
    if cat == "external-storage":
        typ = pick(["Portable HDD", "Portable HDD", "Portable SSD", "Portable SSD", "Desktop HDD"], t)
        cap = pick(["1 TB", "2 TB", "1 TB", "2 TB", "8 TB"], t)
        return f"Carry {pick(['H1', 'H2', 'S5', 'S9', 'D8'], t)}", f"{cap} {typ}", [
            f"{cap} {typ}", f"Up to {pick([140, 140, 1050, 2000, 250], t)} MB/s", "USB-C"
        ], [
            ("Storage", [("Type", typ), ("Capacity", cap)]),
            ("Performance", [("Transfer speed", f"Up to {pick([140, 140, 1050, 2000, 250], t)} MB/s"),
                             ("Interface", pick(["USB 3.2 Gen 1", "USB 3.2 Gen 1", "USB 3.2 Gen 2", "USB 3.2 Gen 2x2", "USB 3.2 Gen 1"], t))]),
            ("Design", [("Encryption", "AES 256-bit hardware" if t > 0.5 else "Software"),
                        ("Rugged", "IP55 drop resistant" if 0.4 < t < 0.8 else "No"), ("Cable", "USB-C to C and C to A")]),
        ]
    # computer-accessory
    kind = pick(["USB-C Hub 4-in-1", "USB-C Hub 7-in-1", "Laptop Stand", "Cooling Pad", "USB-C Docking Station"], t)
    return f"Kit {kind.split()[0][:3].upper()}{int(t * 9) + 1}", kind, [
        kind, "Aluminium build" if t > 0.3 else "ABS build", "Plug and play"
    ], [
        ("General", [("Type", kind), ("Material", "Aluminium" if t > 0.3 else "ABS plastic"),
                     ("Compatibility", "Windows, macOS, Linux, ChromeOS")]),
        ("Ports & power", [("Ports", pick(["HDMI, 2 x USB-A, PD", "HDMI, 3 x USB-A, SD, PD, LAN", "N/A", "2 x USB-A pass-through",
                                          "2 x HDMI, DP, 4 x USB, LAN, PD 100 W"], t)),
                           ("Power delivery", pick(["60 W", "100 W", "N/A", "N/A", "100 W"], t))]),
    ]


# ---------------------------------------------------------------- images ---
PALETTES = [
    ("#1e293b", "#3b82f6", "#e0ecff"),
    ("#111827", "#f97316", "#fff1e6"),
    ("#334155", "#10b981", "#e3f8ef"),
    ("#27272a", "#8b5cf6", "#efe9ff"),
]


def device_svg(cat, body, accent):
    """Original flat illustration per category on a 800x800 canvas."""
    b, a = body, accent
    lite = "#cbd5e1"
    if cat in ("gaming-laptop", "business-laptop"):
        return f'''<rect x="170" y="210" width="460" height="290" rx="16" fill="{b}"/>
<rect x="190" y="230" width="420" height="250" rx="6" fill="{a}" opacity=".85"/>
<path d="M120 510h560l-40 50H160z" fill="{b}"/><rect x="350" y="515" width="100" height="10" rx="5" fill="{lite}"/>
<path d="M210 450l120-110 80 70 60-50 120 90z" fill="#fff" opacity=".25"/>'''
    if cat == "desktop-pc":
        return f'''<rect x="290" y="170" width="220" height="440" rx="18" fill="{b}"/>
<rect x="310" y="190" width="180" height="300" rx="10" fill="{a}" opacity=".35"/>
<circle cx="400" cy="270" r="50" fill="none" stroke="{a}" stroke-width="10"/><circle cx="400" cy="410" r="50" fill="none" stroke="{a}" stroke-width="10"/>
<circle cx="400" cy="560" r="12" fill="{a}"/>'''
    if cat in ("gaming-monitor", "office-monitor"):
        return f'''<rect x="140" y="190" width="520" height="320" rx="14" fill="{b}"/>
<rect x="158" y="208" width="484" height="270" rx="4" fill="{a}" opacity=".85"/>
<path d="M180 450l140-120 90 80 70-60 140 100z" fill="#fff" opacity=".25"/>
<rect x="380" y="510" width="40" height="80" fill="{b}"/><rect x="290" y="585" width="220" height="22" rx="11" fill="{b}"/>'''
    if cat in ("smartphone", "tablet"):
        w, h = (220, 420) if cat == "smartphone" else (380, 500)
        x, y = 400 - w // 2, 400 - h // 2
        return f'''<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{36 if cat == 'smartphone' else 28}" fill="{b}"/>
<rect x="{x + 14}" y="{y + 14}" width="{w - 28}" height="{h - 28}" rx="{24 if cat == 'smartphone' else 16}" fill="{a}" opacity=".85"/>
<circle cx="400" cy="{y + 32}" r="7" fill="{b}"/><path d="M{x + 14} {y + h - 120}l{w // 3} -90 {w // 4} 60 {w // 3} -70 0 140h{-(w - 28)}z" fill="#fff" opacity=".25"/>'''
    if cat == "smartwatch":
        return f'''<rect x="335" y="140" width="130" height="520" rx="40" fill="{b}" opacity=".85"/>
<rect x="290" y="270" width="220" height="260" rx="56" fill="{b}"/><rect x="306" y="286" width="188" height="228" rx="44" fill="{a}"/>
<path d="M330 410h40l20-40 25 80 20-50 15 10h40" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round"/>
<rect x="508" y="370" width="16" height="60" rx="8" fill="{b}"/>'''
    if cat == "processor":
        pins = "".join(f'<rect x="{230 + i * 40}" y="200" width="12" height="40" fill="{lite}"/><rect x="{230 + i * 40}" y="560" width="12" height="40" fill="{lite}"/>'
                       f'<rect x="200" y="{230 + i * 40}" width="40" height="12" fill="{lite}"/><rect x="560" y="{230 + i * 40}" width="40" height="12" fill="{lite}"/>' for i in range(9))
        return pins + f'''<rect x="230" y="230" width="340" height="340" rx="18" fill="{b}"/>
<rect x="290" y="290" width="220" height="220" rx="12" fill="{a}"/><rect x="330" y="330" width="140" height="140" rx="8" fill="#fff" opacity=".3"/>'''
    if cat == "motherboard":
        return f'''<rect x="170" y="170" width="460" height="460" rx="12" fill="{b}"/>
<rect x="220" y="220" width="130" height="130" rx="8" fill="{a}"/><rect x="390" y="210" width="16" height="190" fill="{lite}"/>
<rect x="420" y="210" width="16" height="190" fill="{lite}"/><rect x="450" y="210" width="16" height="190" fill="{lite}"/><rect x="480" y="210" width="16" height="190" fill="{lite}"/>
<rect x="210" y="430" width="380" height="22" rx="4" fill="{a}" opacity=".8"/><rect x="210" y="500" width="380" height="22" rx="4" fill="{lite}"/>
<rect x="540" y="560" width="60" height="50" rx="6" fill="{a}" opacity=".6"/>'''
    if cat == "graphics-card":
        return f'''<rect x="120" y="270" width="560" height="230" rx="22" fill="{b}"/>
<circle cx="260" cy="385" r="80" fill="{a}" opacity=".85"/><circle cx="540" cy="385" r="80" fill="{a}" opacity=".85"/>
<circle cx="260" cy="385" r="22" fill="{b}"/><circle cx="540" cy="385" r="22" fill="{b}"/>
<rect x="170" y="500" width="300" height="26" fill="{lite}"/><rect x="680" y="300" width="22" height="170" fill="{lite}"/>'''
    if cat in ("desktop-ram", "laptop-ram"):
        w = 560 if cat == "desktop-ram" else 380
        x = 400 - w // 2
        chips = "".join(f'<rect x="{x + 30 + i * ((w - 60) // 8)}" y="330" width="{(w - 60) // 8 - 12}" height="70" rx="4" fill="{b}"/>' for i in range(8))
        return f'''<rect x="{x}" y="300" width="{w}" height="170" rx="10" fill="{a}"/>{chips}
<rect x="{x + 20}" y="470" width="{w - 40}" height="26" fill="#d4a017"/><rect x="{x + w // 2 - 6}" y="470" width="12" height="26" fill="#fff"/>'''
    if cat == "internal-ssd":
        return f'''<rect x="130" y="330" width="540" height="140" rx="10" fill="{b}"/>
<rect x="190" y="350" width="280" height="100" rx="6" fill="{a}"/><rect x="490" y="365" width="90" height="70" rx="4" fill="{lite}"/>
<rect x="640" y="355" width="20" height="90" fill="#d4a017"/><circle cx="150" cy="400" r="10" fill="#fff"/>'''
    if cat in ("hard-drive", "external-storage"):
        return f'''<rect x="230" y="160" width="340" height="480" rx="26" fill="{b}"/>
<circle cx="400" cy="340" r="130" fill="{a}" opacity=".85"/><circle cx="400" cy="340" r="26" fill="{b}"/>
<path d="M400 340L520 500" stroke="{lite}" stroke-width="16" stroke-linecap="round"/><rect x="290" y="560" width="220" height="30" rx="6" fill="{lite}" opacity=".6"/>'''
    if cat == "power-supply":
        grid = "".join(f'<circle cx="{330 + (i % 5) * 35}" cy="{330 + (i // 5) * 35}" r="9" fill="{b}"/>' for i in range(25))
        return f'''<rect x="170" y="230" width="460" height="340" rx="18" fill="{b}"/>
<circle cx="400" cy="400" r="130" fill="{a}"/>{grid}<rect x="560" y="260" width="50" height="34" rx="4" fill="{lite}"/>'''
    if cat == "computer-case":
        return f'''<rect x="260" y="140" width="280" height="520" rx="16" fill="{b}"/>
<rect x="290" y="170" width="220" height="460" rx="8" fill="{a}" opacity=".25"/>
<circle cx="400" cy="250" r="44" fill="none" stroke="{a}" stroke-width="8"/><circle cx="400" cy="370" r="44" fill="none" stroke="{a}" stroke-width="8"/>
<circle cx="400" cy="490" r="44" fill="none" stroke="{a}" stroke-width="8"/>'''
    if cat == "cpu-cooler":
        fins = "".join(f'<rect x="250" y="{210 + i * 26}" width="300" height="12" rx="3" fill="{lite}"/>' for i in range(12))
        return fins + f'''<rect x="320" y="230" width="160" height="300" rx="18" fill="{b}" opacity=".9"/>
<circle cx="400" cy="380" r="70" fill="{a}"/><circle cx="400" cy="380" r="20" fill="{b}"/><rect x="360" y="530" width="80" height="60" rx="6" fill="{b}"/>'''
    if cat == "mechanical-keyboard":
        keys = "".join(f'<rect x="{150 + c * 42}" y="{300 + rr * 44}" width="34" height="34" rx="6" fill="{a if (c + rr) % 7 == 0 else lite}"/>' for rr in range(4) for c in range(12))
        return f'<rect x="130" y="280" width="540" height="240" rx="18" fill="{b}"/>{keys}<rect x="240" y="476" width="320" height="34" rx="6" fill="{lite}"/>'
    if cat == "gaming-mouse":
        return f'''<path d="M400 180c-100 0-150 90-150 200v80c0 100 70 170 150 170s150-70 150-170v-80c0-110-50-200-150-200z" fill="{b}"/>
<path d="M400 180v190" stroke="{lite}" stroke-width="6"/><rect x="388" y="240" width="24" height="60" rx="12" fill="{a}"/>
<path d="M280 520c40 60 200 60 240 0" stroke="{a}" stroke-width="12" fill="none" stroke-linecap="round"/>'''
    if cat == "headphone":
        return f'''<path d="M220 440v-60a180 180 0 0 1 360 0v60" stroke="{b}" stroke-width="34" fill="none" stroke-linecap="round"/>
<rect x="180" y="410" width="110" height="180" rx="40" fill="{b}"/><rect x="510" y="410" width="110" height="180" rx="40" fill="{b}"/>
<rect x="205" y="440" width="60" height="120" rx="26" fill="{a}"/><rect x="535" y="440" width="60" height="120" rx="26" fill="{a}"/>'''
    if cat == "microphone":
        grill = "".join(f'<path d="M335 {230 + i * 30}h130" stroke="{lite}" stroke-width="6" opacity=".6"/>' for i in range(7))
        return f'''<rect x="320" y="170" width="160" height="290" rx="80" fill="{b}"/>{grill}
<path d="M290 400v20a110 110 0 0 0 220 0v-20" stroke="{a}" stroke-width="16" fill="none"/>
<rect x="390" y="530" width="20" height="70" fill="{a}"/><rect x="310" y="590" width="180" height="24" rx="12" fill="{b}"/>'''
    if cat == "webcam":
        return f'''<rect x="210" y="260" width="380" height="180" rx="90" fill="{b}"/>
<circle cx="400" cy="350" r="70" fill="{a}"/><circle cx="400" cy="350" r="36" fill="{b}"/><circle cx="388" cy="338" r="10" fill="#fff" opacity=".7"/>
<path d="M360 440l-30 120h140l-30-120" fill="{b}" opacity=".85"/><rect x="290" y="555" width="220" height="24" rx="12" fill="{b}"/>'''
    if cat == "router":
        return f'''<rect x="180" y="400" width="440" height="140" rx="26" fill="{b}"/>
<rect x="230" y="200" width="22" height="210" rx="11" fill="{b}"/><rect x="330" y="170" width="22" height="240" rx="11" fill="{b}"/>
<rect x="448" y="170" width="22" height="240" rx="11" fill="{b}"/><rect x="548" y="200" width="22" height="210" rx="11" fill="{b}"/>
<circle cx="260" cy="470" r="10" fill="{a}"/><circle cx="300" cy="470" r="10" fill="{a}"/><circle cx="340" cy="470" r="10" fill="{a}"/>
<rect x="420" y="460" width="160" height="20" rx="10" fill="{a}" opacity=".7"/>'''
    if cat == "network-switch":
        ports = "".join(f'<rect x="{170 + i * 50}" y="365" width="38" height="34" rx="4" fill="{lite}"/><circle cx="{189 + i * 50}" cy="420" r="5" fill="{a}"/>' for i in range(8))
        return f'<rect x="140" y="320" width="520" height="140" rx="14" fill="{b}"/>{ports}'
    if cat == "printer":
        return f'''<rect x="270" y="170" width="260" height="140" rx="6" fill="#fff" stroke="{lite}" stroke-width="6"/>
<rect x="170" y="290" width="460" height="220" rx="26" fill="{b}"/><rect x="230" y="470" width="340" height="120" rx="6" fill="#fff" stroke="{lite}" stroke-width="6"/>
<rect x="520" y="330" width="70" height="30" rx="6" fill="{a}"/><rect x="250" y="500" width="200" height="12" rx="6" fill="{a}" opacity=".5"/>'''
    if cat == "scanner":
        return f'''<path d="M170 300l60-60h340l60 60z" fill="{b}" opacity=".85"/>
<rect x="150" y="300" width="500" height="200" rx="22" fill="{b}"/><rect x="190" y="330" width="420" height="20" rx="10" fill="{a}"/>
<rect x="540" y="430" width="70" height="30" rx="6" fill="{a}" opacity=".7"/>'''
    if cat == "ups":
        return f'''<rect x="270" y="170" width="260" height="460" rx="26" fill="{b}"/>
<rect x="310" y="230" width="180" height="90" rx="8" fill="{a}" opacity=".85"/>
<path d="M410 250l-40 50h30l-15 50 50-60h-30z" fill="#fff"/><circle cx="400" cy="400" r="26" fill="none" stroke="{a}" stroke-width="10"/>
<rect x="320" y="480" width="160" height="12" rx="6" fill="{lite}"/><rect x="320" y="510" width="160" height="12" rx="6" fill="{lite}"/>'''
    # computer-accessory: USB-C hub
    return f'''<rect x="200" y="320" width="400" height="160" rx="40" fill="{b}"/>
<rect x="250" y="380" width="60" height="40" rx="8" fill="{lite}"/><rect x="330" y="380" width="60" height="40" rx="8" fill="{lite}"/>
<rect x="410" y="384" width="54" height="32" rx="16" fill="{lite}"/><rect x="484" y="384" width="54" height="32" rx="6" fill="{a}"/>
<path d="M600 400h80" stroke="{b}" stroke-width="22" stroke-linecap="round"/><rect x="680" y="385" width="50" height="30" rx="10" fill="{a}"/>'''


def write_svg(cat, idx):
    body, accent, bg = PALETTES[idx]
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-label="Representative illustration">
<defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="{bg}"/></radialGradient></defs>
<rect width="800" height="800" fill="url(#g)"/><ellipse cx="400" cy="660" rx="260" ry="26" fill="#0f172a" opacity=".08"/>
{device_svg(cat, body, accent)}
</svg>
'''
    d = os.path.join(IMG_DIR, cat)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, f"{idx + 1}.svg"), "w") as f:
        f.write(svg)


def main():
    products = json.load(open(SRC))
    by_cat = {}
    for p in products:
        by_cat.setdefault(p["category_handle"], []).append(p)

    out = []
    seen = {}
    for cat, items in by_cat.items():
        for i in range(IMG_VARIANTS):
            write_svg(cat, i)
        ranked = sorted(items, key=lambda p: (p["price_bdt"], p["sku"]))
        for rank, p in enumerate(ranked):
            t = rank / max(1, len(ranked) - 1)
            r = random.Random(p["sku"])
            model, descriptor, highlights, groups = specs_for(cat, t, r)
            base_title = f"{p['brand']} {model} {descriptor}"
            n = seen.get(base_title, 0)
            seen[base_title] = n + 1
            if n:
                model = f"{model} Mk {['', 'II', 'III', 'IV', 'V', 'VI'][n]}"
            img_idx = (rank % IMG_VARIANTS) + 1
            image = f"/catalog/{cat}/{img_idx}.svg"
            title = f"{p['brand']} {model} {descriptor}"
            warranty = "2 years" if p["price_bdt"] > 20000 else "1 year"
            spec_groups = [
                {"group": "Overview", "items": [
                    {"label": "Brand", "value": f"{p['brand']} (fictional test brand)"},
                    {"label": "Model", "value": model},
                    {"label": "Category", "value": p["category"]},
                    {"label": "SKU", "value": p["sku"]},
                ]},
                *[{"group": g, "items": [{"label": k, "value": str(v)} for k, v in rows]} for g, rows in groups],
                {"group": "Warranty", "items": [{"label": "Warranty", "value": f"{warranty} (test fixture)"}]},
            ]
            description = (
                f"The {p['brand']} {model} is a {descriptor.lower()} in our {p['category']} range. "
                f"Key features: {', '.join(highlights)}. {DISCLAIMER}"
            )
            out.append({
                "handle": p["handle"],
                "sku": p["sku"],
                "category_handle": cat,
                "brand": p["brand"],
                "title": title,
                "subtitle": " | ".join(highlights),
                "description": description,
                "thumbnail": image,
                "images": [image],
                "price_bdt": p["price_bdt"],
                "metadata": {
                    "brand": p["brand"],
                    "model": model,
                    "highlights": highlights,
                    "specs": spec_groups,
                    "warranty": warranty,
                    "image_type": "representative-illustration",
                    "data_source": "synthetic-test-fixture",
                    "synthetic_catalog": True,
                    "declared_stock": p["stock"],
                },
            })

    json.dump(out, open(OUT, "w"), indent=1)
    print(f"wrote {len(out)} products, {len(by_cat) * IMG_VARIANTS} images")


if __name__ == "__main__":
    main()
