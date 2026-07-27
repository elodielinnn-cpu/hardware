#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <Foundation/Foundation.h>
#import <IOKit/IOKitLib.h>
#import <unistd.h>

static const NSTimeInterval IdleThresholdSeconds = 15 * 60;
static const NSTimeInterval MinimumClickIntervalSeconds = 15 * 60;
static NSString *const StateDirectoryName = @"WeChatIdleClicker";
static NSString *const StateFileName = @"last-click.txt";

static void LogError(NSString *message) {
    fprintf(stderr, "[wechat-idle-clicker] %s\n", message.UTF8String);
}

static BOOL IsScreenLocked(void) {
    if (CGDisplayIsAsleep(CGMainDisplayID())) {
        return YES;
    }

    CFDictionaryRef session = CGSessionCopyCurrentDictionary();
    if (session == NULL) {
        return YES;
    }

    CFBooleanRef value = CFDictionaryGetValue(
        session,
        CFSTR("CGSSessionScreenIsLocked")
    );
    BOOL locked = value == NULL || CFBooleanGetValue(value);
    CFRelease(session);
    return locked;
}

static NSNumber *SystemIdleSeconds(void) {
    io_registry_entry_t service = IOServiceGetMatchingService(
        kIOMainPortDefault,
        IOServiceMatching("IOHIDSystem")
    );
    if (service == IO_OBJECT_NULL) {
        return nil;
    }

    CFTypeRef value = IORegistryEntryCreateCFProperty(
        service,
        CFSTR("HIDIdleTime"),
        kCFAllocatorDefault,
        0
    );
    IOObjectRelease(service);

    if (value == NULL || CFGetTypeID(value) != CFNumberGetTypeID()) {
        if (value != NULL) {
            CFRelease(value);
        }
        return nil;
    }

    uint64_t nanoseconds = 0;
    BOOL readSucceeded = CFNumberGetValue(
        value,
        kCFNumberSInt64Type,
        &nanoseconds
    );
    CFRelease(value);
    if (!readSucceeded) {
        return nil;
    }
    return @((double)nanoseconds / 1e9);
}

static NSURL *StateFileURL(NSError **error) {
    NSURL *applicationSupport = [[NSFileManager defaultManager]
        URLForDirectory:NSApplicationSupportDirectory
        inDomain:NSUserDomainMask
        appropriateForURL:nil
        create:YES
        error:error
    ];
    if (applicationSupport == nil) {
        return nil;
    }

    NSURL *directory = [applicationSupport
        URLByAppendingPathComponent:StateDirectoryName
        isDirectory:YES
    ];
    if (![[NSFileManager defaultManager]
        createDirectoryAtURL:directory
        withIntermediateDirectories:YES
        attributes:nil
        error:error
    ]) {
        return nil;
    }
    return [directory URLByAppendingPathComponent:StateFileName];
}

static NSDate *LastClickDate(void) {
    NSError *error = nil;
    NSURL *url = StateFileURL(&error);
    if (url == nil) {
        return nil;
    }

    NSString *contents = [NSString
        stringWithContentsOfURL:url
        encoding:NSUTF8StringEncoding
        error:nil
    ];
    if (contents == nil) {
        return nil;
    }

    NSTimeInterval timestamp = contents.doubleValue;
    return timestamp > 0
        ? [NSDate dateWithTimeIntervalSince1970:timestamp]
        : nil;
}

static BOOL RecordClick(NSDate *date, NSError **error) {
    NSURL *url = StateFileURL(error);
    if (url == nil) {
        return NO;
    }

    NSString *timestamp = [NSString stringWithFormat:@"%.6f",
        date.timeIntervalSince1970
    ];
    return [timestamp
        writeToURL:url
        atomically:YES
        encoding:NSUTF8StringEncoding
        error:error
    ];
}

static CFTypeRef CopyAttribute(AXUIElementRef element, CFStringRef attribute) {
    CFTypeRef value = NULL;
    if (AXUIElementCopyAttributeValue(element, attribute, &value)
        != kAXErrorSuccess) {
        return NULL;
    }
    return value;
}

static BOOL ElementMatchesWeChatName(AXUIElementRef element) {
    CFStringRef attributes[] = {
        kAXTitleAttribute,
        kAXDescriptionAttribute,
        kAXHelpAttribute,
    };
    NSArray<NSString *> *names = @[@"WeChat", @"微信"];

    for (size_t index = 0;
         index < sizeof(attributes) / sizeof(attributes[0]);
         index++) {
        CFTypeRef value = CopyAttribute(element, attributes[index]);
        if (value == NULL) {
            continue;
        }
        if (CFGetTypeID(value) == CFStringGetTypeID()) {
            NSString *label = (__bridge NSString *)value;
            for (NSString *name in names) {
                NSStringCompareOptions options = NSCaseInsensitiveSearch
                    | NSDiacriticInsensitiveSearch;
                BOOL exactMatch = [label compare:name options:options]
                    == NSOrderedSame;
                BOOL notificationSuffix = NO;
                if (label.length > name.length
                    && [[label substringToIndex:name.length]
                        compare:name
                        options:options] == NSOrderedSame) {
                    unichar separator = [label characterAtIndex:name.length];
                    notificationSuffix = separator == ','
                        || separator == 0xFF0C;
                }
                if (exactMatch || notificationSuffix) {
                    CFRelease(value);
                    return YES;
                }
            }
        }
        CFRelease(value);
    }
    return NO;
}

static AXUIElementRef FindWeChatDockItem(
    AXUIElementRef element,
    NSInteger remainingDepth
) {
    if (ElementMatchesWeChatName(element)) {
        return (AXUIElementRef)CFRetain(element);
    }
    if (remainingDepth <= 0) {
        return NULL;
    }

    CFTypeRef value = CopyAttribute(element, kAXChildrenAttribute);
    if (value == NULL || CFGetTypeID(value) != CFArrayGetTypeID()) {
        if (value != NULL) {
            CFRelease(value);
        }
        return NULL;
    }

    CFArrayRef children = (CFArrayRef)value;
    for (CFIndex index = 0; index < CFArrayGetCount(children); index++) {
        AXUIElementRef child = (AXUIElementRef)CFArrayGetValueAtIndex(
            children,
            index
        );
        AXUIElementRef match = FindWeChatDockItem(
            child,
            remainingDepth - 1
        );
        if (match != NULL) {
            CFRelease(children);
            return match;
        }
    }
    CFRelease(children);
    return NULL;
}

static BOOL CopyElementFrame(AXUIElementRef element, CGRect *frame) {
    CFTypeRef positionValue = CopyAttribute(element, kAXPositionAttribute);
    CFTypeRef sizeValue = CopyAttribute(element, kAXSizeAttribute);
    if (positionValue == NULL || sizeValue == NULL
        || CFGetTypeID(positionValue) != AXValueGetTypeID()
        || CFGetTypeID(sizeValue) != AXValueGetTypeID()) {
        if (positionValue != NULL) {
            CFRelease(positionValue);
        }
        if (sizeValue != NULL) {
            CFRelease(sizeValue);
        }
        return NO;
    }

    CGPoint position = CGPointZero;
    CGSize size = CGSizeZero;
    BOOL succeeded = AXValueGetType((AXValueRef)positionValue)
            == kAXValueCGPointType
        && AXValueGetType((AXValueRef)sizeValue) == kAXValueCGSizeType
        && AXValueGetValue(
            (AXValueRef)positionValue,
            kAXValueCGPointType,
            &position
        )
        && AXValueGetValue(
            (AXValueRef)sizeValue,
            kAXValueCGSizeType,
            &size
        );
    CFRelease(positionValue);
    CFRelease(sizeValue);

    if (succeeded) {
        *frame = (CGRect){position, size};
    }
    return succeeded;
}

static NSError *ClickWeChatDockIcon(void) {
    if (!AXIsProcessTrusted()) {
        return [NSError
            errorWithDomain:@"WeChatIdleClicker"
            code:1
            userInfo:@{
                NSLocalizedDescriptionKey:
                    @"Accessibility permission is required."
            }
        ];
    }

    NSRunningApplication *dock = [NSRunningApplication
        runningApplicationsWithBundleIdentifier:@"com.apple.dock"
    ].firstObject;
    if (dock == nil) {
        return [NSError
            errorWithDomain:@"WeChatIdleClicker"
            code:2
            userInfo:@{NSLocalizedDescriptionKey:
                @"The Dock process is not running."}
        ];
    }

    AXUIElementRef dockElement = AXUIElementCreateApplication(
        dock.processIdentifier
    );
    AXUIElementRef icon = FindWeChatDockItem(dockElement, 8);
    CFRelease(dockElement);
    if (icon == NULL) {
        return [NSError
            errorWithDomain:@"WeChatIdleClicker"
            code:3
            userInfo:@{NSLocalizedDescriptionKey:
                @"WeChat icon was not found in the Dock."}
        ];
    }

    CGRect frame = CGRectZero;
    BOOL hasFrame = CopyElementFrame(icon, &frame);
    if (!hasFrame) {
        CFRelease(icon);
        return [NSError
            errorWithDomain:@"WeChatIdleClicker"
            code:4
            userInfo:@{NSLocalizedDescriptionKey:
                @"The WeChat Dock icon frame could not be read."}
        ];
    }

    CGPoint clickPoint = CGPointMake(
        CGRectGetMidX(frame),
        CGRectGetMidY(frame)
    );
    CGEventRef move = CGEventCreateMouseEvent(
        NULL,
        kCGEventMouseMoved,
        clickPoint,
        kCGMouseButtonLeft
    );
    if (move == NULL) {
        CFRelease(icon);
        return [NSError
            errorWithDomain:@"WeChatIdleClicker"
            code:5
            userInfo:@{NSLocalizedDescriptionKey:
                @"A mouse move event could not be created."}
        ];
    }

    // Moving first reveals an auto-hidden Dock. Read the frame again after
    // the animation because Dock magnification can shift the icon.
    CGEventPost(kCGHIDEventTap, move);
    CFRelease(move);
    usleep(400000);
    if (CopyElementFrame(icon, &frame)) {
        clickPoint = CGPointMake(
            CGRectGetMidX(frame),
            CGRectGetMidY(frame)
        );
    }
    CFRelease(icon);

    CGEventRef down = CGEventCreateMouseEvent(
        NULL,
        kCGEventLeftMouseDown,
        clickPoint,
        kCGMouseButtonLeft
    );
    CGEventRef up = CGEventCreateMouseEvent(
        NULL,
        kCGEventLeftMouseUp,
        clickPoint,
        kCGMouseButtonLeft
    );
    if (down == NULL || up == NULL) {
        if (down != NULL) CFRelease(down);
        if (up != NULL) CFRelease(up);
        return [NSError
            errorWithDomain:@"WeChatIdleClicker"
            code:5
            userInfo:@{NSLocalizedDescriptionKey:
                @"A mouse click event could not be created."}
        ];
    }

    CGEventPost(kCGHIDEventTap, down);
    usleep(80000);
    CGEventPost(kCGHIDEventTap, up);
    CFRelease(down);
    CFRelease(up);
    return nil;
}

static BOOL ShouldClick(NSDate *now, BOOL isTest) {
    if (IsScreenLocked()) {
        return NO;
    }
    if (isTest) {
        return YES;
    }

    NSNumber *idleSeconds = SystemIdleSeconds();
    if (idleSeconds == nil
        || idleSeconds.doubleValue < IdleThresholdSeconds) {
        return NO;
    }

    NSDate *previousClick = LastClickDate();
    return previousClick == nil
        || [now timeIntervalSinceDate:previousClick]
            >= MinimumClickIntervalSeconds;
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        BOOL isTest = argc > 1
            && strcmp(argv[1], "--test-click") == 0;
        NSDate *now = [NSDate date];

        if (!ShouldClick(now, isTest) || IsScreenLocked()) {
            return EXIT_SUCCESS;
        }

        NSError *clickError = ClickWeChatDockIcon();
        if (clickError != nil) {
            LogError(clickError.localizedDescription);
            return EXIT_FAILURE;
        }

        NSError *stateError = nil;
        if (!RecordClick(now, &stateError)) {
            LogError(stateError.localizedDescription);
            return EXIT_FAILURE;
        }
        return EXIT_SUCCESS;
    }
}
