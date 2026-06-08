import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export async function createFirebaseSync({ config, tripId, onRemoteState }) {
  const app = initializeApp(config);
  const db = getFirestore(app);
  const docRef = doc(db, "trips", tripId);

  let suppressNextSnapshot = false;
  let writeTimer = null;

  const unsubscribe = onSnapshot(docRef, (snapshot) => {
    if (!snapshot.exists() || suppressNextSnapshot) {
      suppressNextSnapshot = false;
      return;
    }

    const data = snapshot.data() || {};
    onRemoteState({
      convoy: data.convoy || {},
      expenses: Array.isArray(data.expenses) ? data.expenses : []
    });
  });

  const maybeSeedFromLocal = async (state) => {
    const existing = await getDoc(docRef);
    if (existing.exists()) return;

    suppressNextSnapshot = true;
    await setDoc(
      docRef,
      {
        convoy: Object.fromEntries(
          Object.entries(state || {}).filter(([key]) => key.startsWith("vehicle_"))
        ),
        expenses: state?.expenses || [],
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  };

  const notifyStateChanged = (state) => {
    clearTimeout(writeTimer);
    writeTimer = setTimeout(async () => {
      suppressNextSnapshot = true;
      await setDoc(
        docRef,
        {
          convoy: Object.fromEntries(
            Object.entries(state || {}).filter(([key]) => key.startsWith("vehicle_"))
          ),
          expenses: state?.expenses || [],
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }, 600);
  };

  return {
    isEnabled: true,
    notifyStateChanged: (state) => {
      maybeSeedFromLocal(state).then(() => notifyStateChanged(state));
    },
    dispose: () => {
      clearTimeout(writeTimer);
      unsubscribe();
    }
  };
}
