import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:google_fonts/google_fonts.dart';

void main() {
  runApp(const GStresserApp());
}

class GStresserApp extends StatelessWidget {
  const GStresserApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'G-STRESSER',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFF00FF9D),
        scaffoldBackgroundColor: const Color(0xFF020205),
        textTheme: GoogleFonts.jetBrainsMonoTextTheme(),
      ),
      home: const MainWebView(),
    );
  }
}

class MainWebView extends StatefulWidget {
  const MainWebView({super.key});

  @override
  State<MainWebView> createState() => _MainWebViewState();
}

class _MainWebViewState extends State<MainWebView> {
  WebViewController? _controller;
  bool _isLoading = true;
  bool _isOffline = false;
  late StreamSubscription<List<ConnectivityResult>> _connectivitySubscription;

  @override
  void initState() {
    super.initState();
    _checkInitialConnectivity();
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen(
      _updateConnectionStatus,
    );

    if (!kIsWeb && (Platform.isAndroid || Platform.isIOS)) {
      _initializeWebView();
    }
  }

  Future<void> _checkInitialConnectivity() async {
    final result = await Connectivity().checkConnectivity();
    _updateConnectionStatus(result);
  }

  void _updateConnectionStatus(List<ConnectivityResult> results) {
    setState(() {
      _isOffline = results.isEmpty || results.contains(ConnectivityResult.none);
    });
  }

  void _initializeWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF020205))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            setState(() => _isLoading = true);
          },
          onPageFinished: (String url) {
            setState(() => _isLoading = false);
          },
          onWebResourceError: (WebResourceError error) {
            debugPrint('WebView Error: ${error.description}');
          },
        ),
      )
      ..loadRequest(Uri.parse('https://stress.vpsgen.com/'));
  }

  @override
  void dispose() {
    _connectivitySubscription.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) {
      return const CyberHUDError(
        icon: Icons.computer,
        title: "CORE MISMATCH",
        message:
            "Mobile HUD requires native hardware bridge. Build for Android/iOS to proceed.",
      );
    }

    if (_isOffline) {
      return CyberHUDError(
        icon: Icons.wifi_off_rounded,
        title: "LINK DISCONNECTED",
        message:
            "No active network bridge detected. Establish connection to rejoin G-STRESSER.",
        onRetry: () => _checkInitialConnectivity(),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF020205),
      body: SafeArea(
        child: Stack(
          children: [
            if (_controller != null) WebViewWidget(controller: _controller!),
            if (_isLoading) const CyberHUDLoader(),
          ],
        ),
      ),
    );
  }
}

class CyberHUDLoader extends StatefulWidget {
  const CyberHUDLoader({super.key});

  @override
  State<CyberHUDLoader> createState() => _CyberHUDLoaderState();
}

class _CyberHUDLoaderState extends State<CyberHUDLoader>
    with SingleTickerProviderStateMixin {
  late AnimationController _anim;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final neonColor = const Color(0xFF00FF9D);
    return Container(
      color: const Color(0xFF020205),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Decorative HUD Corners
            SizedBox(
              width: 200,
              height: 200,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  _HUDCorner(top: 0, left: 0),
                  _HUDCorner(top: 0, right: 0, quarterTurns: 1),
                  _HUDCorner(bottom: 0, right: 0, quarterTurns: 2),
                  _HUDCorner(bottom: 0, left: 0, quarterTurns: 3),

                  RotationTransition(
                    turns: _anim,
                    child: Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        borderRadius: BorderRadius.circular(100),
                        border: Border.all(
                          color: neonColor.withOpacity(0.1),
                          width: 1,
                        ),
                      ),
                      child: CircularProgressIndicator(
                        color: neonColor,
                        strokeWidth: 1.5,
                      ),
                    ),
                  ),
                  Text(
                    "LINKING",
                    style: GoogleFonts.orbitron(
                      color: neonColor,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 4,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 30),
            Text(
              "ESTABLISHING SECURE PROTOCOLS...",
              style: GoogleFonts.jetBrainsMono(
                color: neonColor.withOpacity(0.5),
                fontSize: 9,
                letterSpacing: 2,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              "SYSTEM: G-STRESSER [v2.5] // ACTIVE",
              style: GoogleFonts.jetBrainsMono(
                color: Colors.white.withOpacity(0.2),
                fontSize: 8,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class CyberHUDError extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  final VoidCallback? onRetry;

  const CyberHUDError({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final dangerColor = const Color(0xFFFF5F56);
    return Scaffold(
      backgroundColor: const Color(0xFF020205),
      body: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(30),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: dangerColor.withOpacity(0.2)),
                  boxShadow: [
                    BoxShadow(
                      color: dangerColor.withOpacity(0.1),
                      blurRadius: 30,
                      spreadRadius: 5,
                    ),
                  ],
                ),
                child: Icon(icon, size: 50, color: dangerColor),
              ),
              const SizedBox(height: 40),
              Text(
                title,
                style: GoogleFonts.orbitron(
                  color: dangerColor,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 4,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                message,
                textAlign: TextAlign.center,
                style: GoogleFonts.jetBrainsMono(
                  color: Colors.white.withOpacity(0.4),
                  fontSize: 11,
                  height: 1.6,
                ),
              ),
              if (onRetry != null) ...[
                const SizedBox(height: 50),
                ElevatedButton(
                  onPressed: onRetry,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    foregroundColor: dangerColor,
                    side: BorderSide(color: dangerColor.withOpacity(0.5)),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 40,
                      vertical: 20,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(5),
                    ),
                    elevation: 0,
                  ),
                  child: Text(
                    "RETRY SYSTEM LINK",
                    style: GoogleFonts.orbitron(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 2,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _HUDCorner extends StatelessWidget {
  final double? top, bottom, left, right;
  final int quarterTurns;

  const _HUDCorner({
    this.top,
    this.bottom,
    this.left,
    this.right,
    this.quarterTurns = 0,
  });

  @override
  Widget build(BuildContext context) {
    final color = const Color(0xFF00FF9D).withOpacity(0.3);
    return Positioned(
      top: top,
      bottom: bottom,
      left: left,
      right: right,
      child: RotatedBox(
        quarterTurns: quarterTurns,
        child: Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            border: Border(
              top: BorderSide(color: color, width: 2),
              left: BorderSide(color: color, width: 2),
            ),
          ),
        ),
      ),
    );
  }
}
