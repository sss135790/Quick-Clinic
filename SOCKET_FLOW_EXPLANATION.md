# Complete Socket.IO Flow in Quick Clinic

This document explains the entire Socket.IO flow from frontend to backend to real-time message delivery.

---

## Overview: Where Sockets Are Used

1. **Chat Messages** — Real-time doctor-patient chat
2. **Appointment Notifications** — New appointment booking alerts to doctor
3. **Appointment Status Updates** — Status changes sent to patient
4. **Notifications** — General notifications displayed to users

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ChatBar Component        Doctor Appointments Page           │
│  (per-relation socket)    (notification socket)              │
│        │                           │                         │
│        │ io(auth: {userId,         │ io(auth: {userId})      │
│        │     relationId})          │                         │
│        │                           │                         │
└────────┼───────────────────────────┼────────────────────────┘
         │                           │
         │   Socket.IO Connection    │
         │   (port 4000)             │
         ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Socket.IO Server (separate Node)               │
│                   socket-server/main.ts                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ setupAuthentication() ─▶ Verifies userId & relationId       │
│ setupEventHandlers()  ─▶ Handles socket events              │
│                                                              │
│ HTTP Endpoints:                                             │
│ POST /api/notifications/appointment                         │
│ POST /api/notifications/appointment-status                  │
│                                                              │
└────────┬──────────────────────┬──────────────────────────────┘
         │                      │
         │ (called from API)    │ (called from API)
         ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│         BACKEND (Next.js API Routes)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ src/app/api/patients/[patientId]/appointments/route.ts      │
│ → Creates appointment, updates slot, calls socket-server    │
│                                                              │
│ src/app/api/doctors/[doctorId]/appointments/[id]/route.ts   │
│ → Updates appointment status, calls socket-server           │
│                                                              │
└────────┬──────────────────────┬──────────────────────────────┘
         │                      │
         │                      │
         ▼                      ▼
   PostgreSQL Database
   (Appointment, Slot, Notification records)
```

---

## Flow 1: CHAT MESSAGE FLOW (Doctor-Patient)

### Step 1: User Opens Chat → Frontend Creates Socket Connection

**File:** [src/components/general/ChatBar.tsx](src/components/general/ChatBar.tsx#L41-L55)

```typescript
// ChatBar component creates a socket with relationId + userId
const socket = io(socketUrl, {
  auth: {
    relationId: doctorPatientRelationId,  // Unique relation ID
    userId,                                // Current user's ID
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});
```

**What happens:**
- Socket.IO client creates a WebSocket connection to the socket-server at `NEXT_PUBLIC_SOCKET_URL` (default: `http://localhost:4000`).
- Sends `auth` in the handshake with `relationId` and `userId`.
- Browser console shows: `"Connecting to Socket.IO server: http://localhost:4000"`

---

### Step 2: Socket Server Receives Connection → Authenticates

**File:** [socket-server/server.ts](socket-server/server.ts#L17-L59)

```typescript
// Server's setupAuthentication() middleware
this.io.use(async (socket: Socket, next) => {
  const { relationId, userId } = socket.handshake.auth;
  
  if (!userId) {
    return next(new Error('Missing userId'));
  }

  // If relationId present → chat connection
  if (relationId) {
    // Look up the relation in database
    const relation = await this.prisma.doctorPatientRelation.findUnique({
      where: { id: relationId },
      include: {
        doctor: { include: { user: true } },
        patient: { include: { user: true } },
      },
    });

    // Verify user has access (is either doctor or patient in this relation)
    const hasAccess =
      relation.doctor.user.id === userId || 
      relation.patient.user.id === userId;

    if (!hasAccess) {
      return next(new Error('Unauthorized'));
    }

    // Attach user info to socket
    (socket as any).relationId = relationId;
    (socket as any).userId = userId;
    (socket as any).userName = relation.doctor.user.id === userId 
      ? relation.doctor.user.name 
      : relation.patient.user.name;
    (socket as any).userRole = relation.doctor.user.id === userId ? 'DOCTOR' : 'PATIENT';
  }

  next();  // Allow connection
});
```

**What happens:**
- Server checks if `userId` exists.
- Server looks up `doctorPatientRelation` by `relationId`.
- Server verifies that the requesting `userId` is either the doctor or patient in that relation.
- If all checks pass, socket is authenticated and added to the connection pool.
- Console shows: `"Chat connection authenticated: Dr. Smith (DOCTOR)"`

---

### Step 3: Authenticated Socket → Join Room & Emit Initial Messages

**File:** [socket-server/server.ts](socket-server/server.ts#L104-L125)

```typescript
private setupEventHandlers(): void {
  this.io.on('connection', (socket: Socket) => {
    const relationId = (socket as any).relationId;
    const userId = (socket as any).userId;
    
    // If has relationId → chat connection
    if (relationId) {
      // Join room for this relation
      socket.join(`relation_${relationId}`);

      // Emit connection confirmation to client
      socket.emit('connected', {
        message: 'Connected successfully',
        userId,
      });

      // Setup chat message handlers
      this.handleGetInitialMessages(socket, relationId);
      this.handleSendMessage(socket, relationId, userId, userName);
    }
  });
}
```

**What happens:**
- Socket joins a room named `relation_${relationId}` (e.g., `relation_abc123`).
- Server emits `"connected"` event back to the client.
- Server sets up event listeners for `get_initial_messages` and `send_message`.

---

### Step 4: Client Receives Connection Confirmation → Requests Initial Messages

**File:** [src/components/general/ChatBar.tsx](src/components/general/ChatBar.tsx#L60-L70)

```typescript
socket.on('connected', (data: any) => {
  console.log('Connection confirmed:', data);
});

// Request initial messages
socket.emit('get_initial_messages', { page: 1, limit: 50 });

socket.on('initial_messages', (data: any) => {
  console.log('Received initial messages:', data);
  setMessages(data.messages || []);
  setLoading(false);
});
```

**What happens:**
- Client receives the `"connected"` event confirming the socket is ready.
- Client emits `"get_initial_messages"` to request chat history.
- Server fetches messages from the database and sends them back.
- Chat UI shows previous messages.

---

### Step 5: User Types a Message → Client Sends It via Socket

**File:** [src/components/general/ChatBar.tsx](src/components/general/ChatBar.tsx#L155-L175)

```typescript
const handleSendMessage = (e: React.FormEvent) => {
  e.preventDefault();

  if (!inputValue.trim()) return;
  
  if (!isConnected || !socketRef.current) {
    setError('Not connected to chat server.');
    return;
  }

  try {
    setSending(true);

    if (socketRef.current.connected) {
      // Emit message via socket
      socketRef.current.emit('send_message', {
        text: inputValue.trim(),
      });

      setInputValue('');
      setError(null);
    }
  } catch (err) {
    console.error('Error sending message:', err);
  } finally {
    setSending(false);
  }
};
```

**What happens:**
- User types message and clicks "Send".
- `handleSendMessage()` is triggered.
- Message is emitted to socket server via `socket.emit('send_message', { text: '...' })`.
- Socket is in room `relation_abc123`, so server receives the message.

---

### Step 6: Server Receives Message → Saves to DB → Broadcasts to Room

**File:** [socket-server/server.ts](socket-server/server.ts#L214-L265)

```typescript
private handleSendMessage(socket: Socket, relationId: string, userId: string, userName: string): void {
  socket.on('send_message', async (data: { text: string }) => {
    try {
      const { text } = data;

      if (!text || !text.trim()) {
        return socket.emit('error', { message: 'Message cannot be empty' });
      }

      // 1. Save message to database
      const message = await this.prisma.chatMessages.create({
        data: {
          text: text.trim(),
          senderId: userId,
          doctorPatientRelationId: relationId,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      });

      // 2. Format message
      const formattedMessage = {
        id: message.id,
        text: message.text,
        senderId: message.senderId,
        senderName: message.sender.name,
        senderRole: message.sender.role,
        createdAt: message.createdAt.toISOString(),
      };

      // 3. Broadcast to all users in this relation room
      this.io.to(`relation_${relationId}`).emit('new_message', {
        message: formattedMessage,
      });

      console.log(`Message sent by ${userName} in relation ${relationId}`);
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
}
```

**What happens:**
- Server receives `'send_message'` event from the client.
- Server saves the message to `chatMessages` table in PostgreSQL.
- Server broadcasts the message to ALL users in the `relation_${relationId}` room (both doctor and patient).
- Database shows: new row in `ChatMessages` with `senderId`, `text`, `doctorPatientRelationId`, `createdAt`.

---

### Step 7: Other User Connected to Same Relation Receives Message in Real-Time

**File:** [src/components/general/ChatBar.tsx](src/components/general/ChatBar.tsx#L83-L90)

```typescript
socket.on('new_message', (data: any) => {
  console.log('Received new message:', data);
  setMessages((prev) => {
    const isDuplicate = prev.some((msg) => msg.id === data.message.id);
    return isDuplicate ? prev : [...prev, data.message];
  });
});
```

**What happens:**
- The other user's browser receives the `"new_message"` event via Socket.IO (real-time).
- Message is added to the chat UI instantly (no page refresh needed).
- Both users see the message in their chat windows.

---

### Chat Flow Summary

```
User A types message
         │
         ▼
ChatBar emits 'send_message' → socket server
         │
         ▼
Server saves to chatMessages table
         │
         ▼
Server broadcasts 'new_message' to all in relation_${relationId} room
         │
         ├────────────────────────────────────┐
         │                                    │
         ▼                                    ▼
User A sees message              User B sees message
(ChatBar receives event)         (ChatBar receives event)
```

---

## Flow 2: APPOINTMENT BOOKING → NOTIFICATION FLOW

### Step 1: Patient Clicks "Book Slot" Button

**File:** [src/components/patient/bookTimeSlot.tsx](src/components/patient/bookTimeSlot.tsx#L76-L115)

```typescript
const handleBookSlot = async (slotId: string, paymentMethod: string, transactionId?: string | null) => {
  if (!patientId) {
    showToast.warning('Please login to book a slot');
    return;
  }

  try {
    setBooking(true);

    const bodyPayload: any = {
      doctorId,
      slotId,
      paymentMethod,
    };

    // POST to Next.js API
    const bookingData = await fetch(`/api/patients/${patientId}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      credentials: 'include',
    });

    if (bookingData.ok) {
      showToast.success('Slot booked successfully');
      
      // Update local UI: mark slot as BOOKED
      setSlots((prevSlots) =>
        prevSlots.map((slot) => (slot.id === slotId ? { ...slot, status: 'BOOKED' } : slot))
      );
    }
  } catch (err: any) {
    showToast.error(err?.message || 'Failed to book slot');
  } finally {
    setBooking(false);
  }
};
```

**What happens:**
- User (patient) clicks "Book Slot" button.
- Frontend POSTs booking data to `/api/patients/${patientId}/appointments`.
- Body contains: `{ doctorId, slotId, paymentMethod }`.

---

### Step 2: Next.js Backend Receives Booking Request

**File:** [src/app/api/patients/[patientId]/appointments/route.ts](src/app/api/patients/[patientId]/appointments/route.ts#L95-L155)

```typescript
export async function POST(
  req: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const { doctorId, slotId, paymentMethod, transactionId } = await req.json();
    const { patientId } = await params;

    // 1. Validate
    if (!doctorId || !slotId) {
      return NextResponse.json(
        { message: "Doctor ID and Slot ID are required" },
        { status: 400 }
      );
    }

    // 2. Create appointment in database
    const appointment = await prisma.appointment.create({
      data: {
        doctorId,
        patientId,
        slotId,
        status: 'PENDING',
        paymentMethod: paymentMethod || 'OFFLINE',
        transactionId,
      },
    });

    // 3. Update slot status
    const slotUpdate = await prisma.slot.update({
      where: { id: slotId },
      data: { status: 'BOOKED' },
    });

    // 4. Call socket-server HTTP endpoint to notify doctor
    try {
      const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 
                             process.env.SOCKET_SERVER_URL || 
                             'http://localhost:4000';
      
      await fetch(`${socketServerUrl}/api/notifications/appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId,
          appointmentId: appointment.id,
        }),
      }).catch((err) => {
        console.warn('Socket server notification failed:', err);
      });
    } catch (notifError) {
      console.warn('Failed to send notification:', notifError);
    }

    // 5. Log audit
    await logAudit(patientId, "Booked Appointment", { appointmentId: appointment.id, doctorId, slotId });

    return NextResponse.json({ appointment, slotUpdate }, { status: 201 });

  } catch (err: any) {
    console.error("Booking Error:", err);
    return NextResponse.json(
      { message: "Internal server error", error: err.message },
      { status: 500 }
    );
  }
}
```

**What happens:**
- Next.js API creates an `Appointment` record with status `'PENDING'`.
- Updates the `Slot` record to status `'BOOKED'`.
- Logs audit event.
- Makes a server-to-server HTTP call to socket-server to trigger a notification.

---

### Step 3: Socket Server HTTP Endpoint Receives Notification Request

**File:** [socket-server/main.ts](socket-server/main.ts#L140-L210)

```typescript
app.post('/api/notifications/appointment', async (req: express.Request, res: express.Response) => {
  try {
    const { doctorId, appointmentId } = req.body;

    if (!doctorId || !appointmentId) {
      return res.status(400).json({ error: 'doctorId and appointmentId are required' });
    }

    // 1. Fetch appointment details
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { include: { user: { include: { location: true } } } },
        doctor: { include: { user: true } },
        slot: true,
      },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // 2. Get doctor's userId
    const doctorUserId = appointment.doctor.user.id;
    const patientName = appointment.patient.user.name;

    // 3. Format date and time
    const slotDate = appointment.slot.date.toLocaleDateString();
    const slotTime = new Date(appointment.slot.startTime).toLocaleTimeString();

    // 4. Create notification message
    const message = `New appointment booking from ${patientName} for ${slotDate} at ${slotTime}`;

    // 5. Save notification to database
    const notification = await prisma.notification.create({
      data: {
        userId: doctorUserId,
        message,
        isRead: false,
        status: 'UNREAD',
      },
    });

    // 6. Send notification via socket (to connected clients)
    socketServer.sendNotificationToUser(doctorUserId, {
      id: notification.id,
      message: notification.message,
      createdAt: notification.createdAt.toISOString(),
      isRead: notification.isRead,
    });

    // 7. Send appointment request data for real-time UI update
    const appointmentData = {
      id: appointment.id,
      patientName: appointment.patient.user.name,
      patientString: appointment.patient.user.email,
      gender: appointment.patient.user.gender,
      appointmentDate: appointment.slot.date.toISOString(),
      appointmentTime: appointment.slot.startTime.toISOString(),
      status: appointment.status,
      city: appointment.patient.user.location?.city || "N/A",
      age: appointment.patient.user.age,
      paymentMethod: appointment.paymentMethod,
    };

    socketServer.sendAppointmentRequest(doctorUserId, appointmentData);

    return res.json({ success: true, notification, appointment: appointmentData });
  } catch (error: unknown) {
    console.error('Error sending appointment notification:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to send notification'
    });
  }
});
```

**What happens:**
- Socket server receives the HTTP POST request.
- Fetches full appointment details (patient, doctor, slot info).
- Creates a `Notification` record in the database.
- Calls `socketServer.sendNotificationToUser()` and `socketServer.sendAppointmentRequest()`.

---

### Step 4: Socket Server Emits to Doctor via Socket.IO

**File:** [socket-server/server.ts](socket-server/server.ts#L188-L206)

```typescript
public sendNotificationToUser(
  userId: string,
  notification: {
    id: string;
    message: string;
    createdAt: string;
    isRead: boolean;
  }
): void {
  // Emit to user's personal notification room
  this.io.to(`user_${userId}`).emit('new_notification', {
    notification,
  });

  console.log(`Notification sent to user ${userId}: ${notification.message}`);
}

public sendAppointmentRequest(
  doctorUserId: string,
  appointment: {
    id: string;
    patientName: string;
    appointmentDate: string;
    appointmentTime: string;
    status: string;
    city: string;
    age: number;
    paymentMethod: string;
  }
): void {
  // Emit to doctor's room
  this.io.to(`user_${doctorUserId}`).emit('new_appointment_request', {
    appointment,
  });

  console.log(`Appointment request sent to doctor ${doctorUserId}: ${appointment.id}`);
}
```

**What happens:**
- Socket server uses Socket.IO's `.to()` method to send message to specific room: `user_${doctorUserId}`.
- Emits two events:
  1. `"new_notification"` — general notification
  2. `"new_appointment_request"` — appointment-specific data for real-time update

---

### Step 5: Doctor's Browser Receives Notification (Real-Time)

**File:** [src/app/(protected)/doctor/appointments/page.tsx](src/app/(protected)/doctor/appointments/page.tsx#L76-L135)

```typescript
// Doctor's browser has this socket connection open
const socket = io(socketUrl, {
  auth: {
    userId,  // Doctor's userId
  },
  transports: ['polling', 'websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

socketRef.current = socket;

socket.on('connect', () => {
  console.log('Appointment requests socket connected');
  setSocketConnected(true);
});

// Listen for new appointment requests
socket.on('new_appointment_request', (data: { appointment: DoctorAppointment }) => {
  console.log('Received new appointment request:', data.appointment);
  
  // Update local state to show new appointment immediately
  setAppointments((prev) => {
    const exists = prev.some((apt) => apt.id === data.appointment.id);
    if (exists) {
      return prev.map((apt) => 
        apt.id === data.appointment.id ? data.appointment : apt
      );
    }
    // Add new appointment at the beginning
    return [data.appointment, ...prev];
  });

  // Optionally refetch to ensure consistency
  if (doctorId) {
    fetchAppointments();
  }
});
```

**What happens:**
- Doctor's page has a socket open with `auth: { userId }` (doctor's user ID).
- Socket listens for `"new_appointment_request"` event.
- When event arrives, new appointment is added to the appointments list immediately.
- UI updates in real-time without page refresh.
- Doctor sees: "New appointment booking from Patient Name for Jan 15, 2024 at 2:00 PM"

---

### Booking → Notification Flow Summary

```
Patient clicks "Book Slot"
         │
         ▼
POST /api/patients/{patientId}/appointments (Next.js API)
         │
         ├─ Create Appointment (DB)
         ├─ Update Slot to BOOKED (DB)
         ├─ Log audit
         │
         └─ Call socket-server HTTP endpoint
                    │
                    ▼
         POST /api/notifications/appointment (socket-server)
                    │
                    ├─ Fetch appointment details
                    ├─ Create Notification record (DB)
                    │
                    ├─ socketServer.sendNotificationToUser()
                    │  └─ io.to(`user_${doctorId}`).emit('new_notification', {...})
                    │
                    └─ socketServer.sendAppointmentRequest()
                       └─ io.to(`user_${doctorId}`).emit('new_appointment_request', {...})
                                      │
                                      ▼
                    Doctor's browser receives event (real-time)
                                      │
                                      ▼
                    Appointments list updates instantly
                    Doctor sees new appointment in UI
```

---

## Flow 3: APPOINTMENT STATUS UPDATE FLOW

Similar to booking, but for status changes (CONFIRMED, CANCELLED, COMPLETED).

### Trigger

Doctor updates appointment status via UI:

**File:** [src/app/api/doctors/[doctorId]/appointments/[appointmentId]/route.ts](src/app/api/doctors/[doctorId]/appointments/[appointmentId]/route.ts#L226-L250)

```typescript
// When doctor clicks "Confirm" or "Cancel" on an appointment
const appointment = await prisma.appointment.update({
  where: { id: appointmentId },
  data: { status: newStatus },
});

// Call socket-server to notify patient
const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
await fetch(`${socketServerUrl}/api/notifications/appointment-status`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    patientUserId: appointment.patientId,
    appointmentId: appointment.id,
    status: newStatus,
    appointmentDate: appointment.slot.date.toISOString(),
    appointmentTime: appointment.slot.startTime.toISOString(),
    doctorName: doctor.user.name,
  }),
});
```

### Socket Server Receives Status Update

**File:** [socket-server/main.ts](socket-server/main.ts#L86-L130)

```typescript
app.post('/api/notifications/appointment-status', async (req: express.Request, res: express.Response) => {
  try {
    const { patientUserId, appointmentId, status, appointmentDate, appointmentTime, doctorName } = req.body;

    // Create appropriate message
    const statusMessages: Record<string, string> = {
      CONFIRMED: `Your appointment with Dr. ${doctorName} has been confirmed`,
      CANCELLED: `Your appointment with Dr. ${doctorName} has been cancelled`,
      COMPLETED: `Your appointment with Dr. ${doctorName} has been completed`,
      RESCHEDULED: `Your appointment with Dr. ${doctorName} has been rescheduled`,
    };

    const message = statusMessages[status] || `Status updated to ${status}`;

    // Create notification in database
    const notification = await prisma.notification.create({
      data: {
        userId: patientUserId,
        message,
        isRead: false,
        status: 'UNREAD',
      },
    });

    // Send via socket
    socketServer.sendAppointmentStatusUpdate(patientUserId, {
      id: appointmentId,
      status,
      appointmentDate,
      appointmentTime,
      doctorName,
    });

    return res.json({ success: true, notification });
  } catch (error: unknown) {
    console.error('Error sending appointment status update:', error);
    return res.status(500).json({ error: 'Failed to send status update' });
  }
});
```

### Patient Receives Status Update (Real-Time)

Patient's socket listener:

```typescript
socket.on('appointment_status_update', (data: { appointment }) => {
  console.log('Appointment status updated:', data.appointment);
  
  // Update UI with new status
  setAppointments((prev) =>
    prev.map((apt) =>
      apt.id === data.appointment.id
        ? { ...apt, status: data.appointment.status }
        : apt
    )
  );
});
```

---

## Socket Connections Used in Frontend

### 1. **useNotifications Hook**
- **File:** [src/hooks/useNotifications.ts](src/hooks/useNotifications.ts)
- **Auth:** `{ userId }`
- **Room:** `user_${userId}`
- **Events Listen:** `new_notification`, `notification_connected`
- **Used in:** [src/app/(protected)/user/notifications/page.tsx](src/app/(protected)/user/notifications/page.tsx#L15)

### 2. **useSocket Hook**
- **File:** [src/hooks/useSocket.ts](src/hooks/useSocket.ts)
- **Auth:** None provided
- **Used in:** [src/components/admin/onboarding/AdminOnboardingForm.tsx](src/components/admin/onboarding/AdminOnboardingForm.tsx#L19)

### 3. **ChatBar Component**
- **File:** [src/components/general/ChatBar.tsx](src/components/general/ChatBar.tsx#L41-L55)
- **Auth:** `{ relationId, userId }`
- **Room:** `relation_${relationId}`
- **Events Listen:** `get_initial_messages`, `send_message`, `new_message`, `user_typing`, `mark_as_read`

### 4. **Doctor Appointments Page**
- **File:** [src/app/(protected)/doctor/appointments/page.tsx](src/app/(protected)/doctor/appointments/page.tsx#L84-L105)
- **Auth:** `{ userId }`
- **Room:** `user_${userId}`
- **Events Listen:** `new_appointment_request`, `notification_connected`

---

## Database Tables Involved

1. **Appointment**
   - `id`, `doctorId`, `patientId`, `slotId`, `status`, `paymentMethod`, `transactionId`
   - Status: `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `RESCHEDULED`

2. **Slot**
   - `id`, `doctorId`, `date`, `startTime`, `endTime`, `status`
   - Status: `AVAILABLE`, `BOOKED`, `HELD`

3. **ChatMessages**
   - `id`, `doctorPatientRelationId`, `senderId`, `text`, `createdAt`
   - Persists all chat messages between a doctor and patient

4. **Notification**
   - `id`, `userId`, `message`, `isRead`, `status`, `createdAt`
   - Records all notifications sent to users

5. **DoctorPatientRelation**
   - `id`, `doctorsUserId`, `patientsUserId`, `createdAt`
   - Establishes which patients are linked to which doctors

---

## Key Concepts

### Rooms
- `user_${userId}` — Personal notification room for a user
- `relation_${relationId}` — Chat room for a specific doctor-patient relation

### Events (Client → Server)
- `send_message` — Send a chat message
- `get_initial_messages` — Request chat history
- `user_typing` — Indicate typing status
- `mark_as_read` — Mark message as read

### Events (Server → Client)
- `new_message` — New chat message received
- `new_notification` — General notification
- `new_appointment_request` — New appointment booking alert
- `appointment_status_update` — Appointment status changed
- `user_typing` — Another user is typing
- `initial_messages` — Chat history response
- `connected` / `notification_connected` — Connection confirmed

### Authentication
- Client provides `userId` (and optionally `relationId`) in the handshake auth.
- Server verifies the user exists and has permission (for relations, checks if user is doctor or patient).
- No JWT verification currently (security recommendation: add JWT verification).

---

## Environment Variables

```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000    # Frontend → Socket server
SOCKET_SERVER_URL=http://localhost:4000         # Backend → Socket server (for HTTP calls)
DATABASE_URL=postgresql://...                   # Socket server & Next.js API use same DB
```

---

## Complete Message Timeline Example

### Chat: Patient Sends "Hello Doctor"

```
00:00 Patient types "Hello Doctor"
00:01 Patient clicks Send button
      → emit 'send_message' { text: "Hello Doctor" }

00:02 Socket server receives on socket with relationId=abc123
      → Creates chatMessages row in DB
      → Emits 'new_message' to room `relation_abc123`

00:03 Patient's ChatBar receives 'new_message'
      → setMessages([...prev, newMessage])
      → UI shows message from patient

00:04 Doctor's ChatBar (same relation) receives 'new_message'
      → setMessages([...prev, newMessage])
      → UI shows message from patient on doctor's screen

Total latency: ~3-4ms (depending on network)
```

---

## Troubleshooting Checklist

- [ ] Socket server is running on correct port (default 4000)
- [ ] `NEXT_PUBLIC_SOCKET_URL` is set in frontend `.env.local`
- [ ] Database connection is working (both frontend API and socket server use same DB)
- [ ] Firebase/Prisma adapters are configured correctly
- [ ] CORS is enabled in socket server for your frontend origin
- [ ] User is authenticated before opening socket connections
- [ ] Relations exist in DB before trying to join relation rooms
- [ ] Socket.IO client version matches server version

