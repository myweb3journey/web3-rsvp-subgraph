import {Address, ipfs, json} from "@graphprotocol/graph-ts"
import {
  ConfirmedAttendee,
  DepositsPaidOut,
  NewEventCreated,
  NewRSVP
} from "../generated/Web3RSVP/Web3RSVP"
import { Account, RSVP, Confirmation, Event} from "../generated/schema"
import { integer } from "@protofire/subgraph-toolkit"

export function handleNewEventCreated(event: NewEventCreated): void {

  // Convert eventID to Hex: 
  let newEvent = Event.load(event.params.eventID.toHex());

  // Check if eventID is loaded, otherwise create a new event:
  if(newEvent == null){
    
    // Generate new event:
    newEvent = new Event(event.params.eventID.toHex());

    // Set the values for each field from the schema:
    newEvent.eventID = event.params.eventID;
    newEvent.eventOwner = event.params.creatorAddress;
    newEvent.eventTimestamp = event.params.eventTimestamp;
    newEvent.maxCapacity = event.params.maxCapacity;
    newEvent.deposit = event.params.deposit;
    newEvent.paidout = false;
    newEvent.totalRSVPs = integer.ZERO;
    newEvent.totalConfirmedAttendies = integer.ZERO;

    // Use CID to access data stored with ipfs (web3.storage). 
    let metadata = ipfs.cat(event.params.eventDataCID + "/data.json");

    if(metadata){

      // Create object from json:
      const value = json.fromBytes(metadata).toObject();

      if(value){

        // Grab data from json:
        const name = value.get("name");
        const description = value.get("description");
        const link = value.get("link");
        const imagePath = value.get("image");

        // Set newEvent w. obtained data:
        if(name){
          newEvent.name = name.toString();
        }
        
        if(description){
          newEvent.description = description.toString();
        }

        if(link){
          newEvent.link = link.toString();
        }
        
        if(imagePath){
          const imageURL = 
            "https://ipfs.io/ipfs/" + 
            event.params.eventDataCID + 
            imagePath.toString();
            newEvent.imageURL = imageURL;
        } else {
          // Return fallback image if no image path:
          const fallbackURL =
          "https://ipfs.io/ipfs/bafybeibssbrlptcefbqfh4vpw2wlmqfj2kgxt3nil4yujxbmdznau3t5wi/event.png";
          newEvent.imageURL = fallbackURL; 
        }
      }
    }
    newEvent.save();
  }
}

function getOrCreateAccount(address: Address): Account {
  
  // Grab account reference from user address:
  let account = Account.load(address.toHex());

  // If no account exists create one:
  if(account == null){
    account = new Account(address.toHex());
    account.totalRSVPS = integer.ZERO;
    account.totalAttendedEvents = integer.ZERO;
    account.save();
  }
  return account;
}

export function handleNewRSVP(event: NewRSVP): void {
  
  // Generate new RSVP & get attendee account info:
  let newRSVP = RSVP.load(event.transaction.from.toHex());
  let account = getOrCreateAccount(event.params.attendeeAddress);
  let thisEvent = Event.load(event.params.eventID.toHex());

  // Create RSVP for event:
  if(newRSVP == null && thisEvent != null){
    newRSVP = new RSVP(event.transaction.from.toHex());
    newRSVP.attendee = account.id;
    newRSVP.event = thisEvent.id;
    newRSVP.save();
    account.totalRSVPS = integer.increment(account.totalRSVPS);
    account.save();
  }
}

export function handleConfirmedAttendee(event: ConfirmedAttendee): void {

  // Get id: 
  let id = event.params.eventID.toHex() + event.params.attendeeAddress.toHex();

  // Load confirmation: 
  let newConfirmation = Confirmation.load(id);

  // Get attendee account: 
  let account = getOrCreateAccount(event.params.attendeeAddress);

  // Get event: 
  let thisEvent = Event.load(event.params.eventID.toHex());

  // Handle attendee:
  if(newConfirmation == null && thisEvent != null){
    
    // Create new confirmation:
    newConfirmation = new Confirmation(id);
    newConfirmation.attendee = account.id;
    newConfirmation.event = thisEvent.id;
    newConfirmation.save();

    // Incremenet totalConfirmedAttendees:
    thisEvent.totalConfirmedAttendies = integer.increment(
      thisEvent.totalConfirmedAttendies
    );
    thisEvent.save();

    // Incremenet totalAttendedEvents for accountee:
    account.totalAttendedEvents = integer.increment(
      account.totalAttendedEvents
    )
    account.save();
  }
}

export function handleDepositsPaidOut(event: DepositsPaidOut): void {

  // Load this event:
  let thisEvent = Event.load(event.params.eventID.toHex());

  // Change the paidOut param to true:
  if(thisEvent){
    thisEvent.paidout = true;
    thisEvent.save();
  }
}
